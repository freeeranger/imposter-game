import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import type { ValueAnimationTransition } from "motion/react";

// Prototypes of softer launch animations, to compare before one replaces the crack.
// Same mask, size and spot as the Android splash (see splash-reveal.tsx).
const CANVAS = 288;
const MASK_TRANSFORM = "translate(54 53.75) scale(7.5)";
const MASK_PATH =
  "M4,6a2,2 0 0,0 -2,2v4a5,5 0 0,0 5,5 8,8 0 0,1 5,2 8,8 0 0,1 5,-2 5,5 0 0,0 5,-5V8a2,2 0 0,0 -2,-2h-3a8,8 0 0,0 -5,2 8,8 0 0,0 -5,-2z";
const LEFT_EYE = "M4.9,11.2a2.5,1.35 0 1,0 5,0a2.5,1.35 0 1,0 -5,0z";
const RIGHT_EYE = "M14.1,11.2a2.5,1.35 0 1,0 5,0a2.5,1.35 0 1,0 -5,0z";
const SPLASH_BACKGROUND = "#15111f";
const LIME = "#C6FF3D";
const PINK = "#FF4FA3";
// The mask's box on screen: 20x13 units at 7.5x.
const MASK_WIDTH = 150;
const MASK_HEIGHT = 97.5;

export type SplashPrototype =
  | "button"
  | "blink"
  | "squash"
  | "ripple"
  | "winkjump";

const OWN_CENTER = {
  transformBox: "fill-box",
  transformOrigin: "center",
} as const;

const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;
const wait = (seconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, seconds * 1000));

// Where the real "let's play" button will sit once the home screen has slid in: its box
// now, minus whatever its (still animating) ancestors are shifted by.
const findLaunchTarget = () => {
  const target = document.querySelector<HTMLElement>("[data-launch-target]");
  if (!target) return null;
  const box = target.getBoundingClientRect();
  if (box.width === 0) return null;
  let shiftY = 0;
  for (let node = target.parentElement; node; node = node.parentElement) {
    const transform = getComputedStyle(node).transform;
    if (transform && transform !== "none") {
      shiftY += new DOMMatrix(transform).m42;
    }
  }
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2 - shiftY,
    width: box.width,
    height: box.height,
  };
};

type SplashPrototypesProps = {
  variant: SplashPrototype;
  play: boolean;
  onOpen: () => void;
  onDone: () => void;
};

function SplashPrototypes({
  variant,
  play,
  onOpen,
  onDone,
}: SplashPrototypesProps) {
  const id = useId();
  const reduceMotion = useReducedMotion();
  const open = useEffectEvent(onOpen);
  const finish = useEffectEvent(onDone);
  const svg = useRef<SVGSVGElement>(null);
  const [size] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const root = svg.current;
    if (!play || !root) return;
    const part = (name: string) =>
      root.querySelector<SVGElement>(`[data-part="${name}"]`)!;
    const set = (name: string, attributes: Record<string, number | string>) => {
      const element = part(name);
      for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, `${value}`);
      }
    };
    const running: { stop: () => void }[] = [];
    const track = <T extends { stop: () => void }>(controls: T) => {
      running.push(controls);
      return controls;
    };
    const tween = (
      options: ValueAnimationTransition<number>,
      onUpdate: (progress: number) => void,
    ) => track(animate(0, 1, { ...options, onUpdate }));
    let cancelled = false;
    const { width, height } = size;

    const blink = async () => {
      // A soft blink, then a wink with a little head tilt...
      await track(
        animate(
          [part("eye-left"), part("eye-right")],
          { scaleY: [1, 0.08, 1] },
          { duration: 0.22, ease: "easeInOut" },
        ),
      );
      await wait(0.1);
      if (cancelled) return;
      await Promise.all([
        track(
          animate(
            part("eye-right"),
            { scaleY: [1, 0.08, 0.08, 1] },
            { duration: 0.34, times: [0, 0.3, 0.6, 1] },
          ),
        ),
        track(
          animate(
            part("mask"),
            { rotate: [0, -9, 0] },
            { duration: 0.42, ease: "easeInOut" },
          ),
        ),
      ]);
      if (cancelled) return;
      // ...and it bows out with a springy shrink while the app rises behind it.
      open();
      await Promise.all([
        track(
          animate(
            part("mask"),
            { scale: [1, 1.1, 0], opacity: [1, 1, 0] },
            {
              duration: 0.45,
              times: [0, 0.35, 1],
              ease: ["easeOut", "easeIn"],
            },
          ),
        ),
        track(
          animate(
            part("backdrop"),
            { opacity: 0 },
            { duration: 0.45, delay: 0.1 },
          ),
        ),
      ]);
    };

    const button = async () => {
      const target = findLaunchTarget();
      if (!target) return blink();
      // A gentle pop...
      await track(
        animate(
          part("mask"),
          { scale: [1, 1.12, 1] },
          { duration: 0.32, ease: "easeInOut" },
        ),
      );
      if (cancelled) return;
      // ...then the mask softens into a pill and swoops down to become the play button.
      open();
      set("pill", { opacity: 1 });
      track(
        animate(part("mask"), { opacity: 0, scale: 0.9 }, { duration: 0.14 }),
      );
      track(
        animate(
          part("backdrop"),
          { opacity: 0 },
          { duration: 0.5, delay: 0.12 },
        ),
      );
      const start = { x: width / 2, y: height / 2 };
      await tween(
        { type: "spring", stiffness: 190, damping: 21, restDelta: 0.004 },
        (p) => {
          const x =
            lerp(start.x, target.x, p) +
            Math.sin(Math.PI * Math.min(p, 1)) * width * 0.16;
          // Slow to leave, fast to land, so it swoops rather than slides.
          const y = lerp(start.y, target.y, p <= 1 ? p * p : p);
          const w = lerp(MASK_WIDTH, target.width, p);
          const h = lerp(MASK_HEIGHT, target.height, p);
          set("pill", {
            x: x - w / 2,
            y: y - h / 2,
            width: Math.max(0, w),
            height: Math.max(0, h),
            rx: Math.min(h / 2, lerp(36, target.height / 2, p)),
          });
        },
      );
      if (cancelled) return;
      // The real button is right underneath now.
      await track(animate(part("pill"), { opacity: 0 }, { duration: 0.18 }));
    };

    // The dark curtain behaves like fabric: the middle of its bottom edge is dragged up
    // behind the jumping mask, while the sides are springs that hang back, get yanked
    // after it and overshoot a little, so the edge wobbles on its way off the top.
    const pullCurtain = () =>
      new Promise<void>((resolve) => {
        const lift = 0.3;
        const top = -height * 0.35;
        let middle = height;
        let side = height;
        let sideSpeed = 0;
        let elapsed = 0;
        let last = performance.now();
        let frame = 0;
        const draw = () => {
          set("backdrop", {
            d:
              `M0 ${-height}H${width}V${side}` +
              // A rounded bell: soft shoulders at the sides, a broad top in the middle.
              `C${width * 0.8} ${side} ${width * 0.72} ${middle} ${width / 2} ${middle}` +
              `C${width * 0.28} ${middle} ${width * 0.2} ${side} 0 ${side}Z`,
          });
        };
        const step = (now: number) => {
          // Small steps keep the spring steady even if a frame comes late.
          const dt = Math.min(0.032, (now - last) / 1000);
          last = now;
          elapsed += dt;
          const t = Math.min(1, elapsed / lift);
          // Accelerates all the way out: a gentle start, then it whips off the top.
          const eased = t ** 3.2;
          const previous = middle;
          middle = lerp(height, top, eased);
          sideSpeed += (700 * (middle - side) - 32 * sideSpeed) * dt;
          side += sideSpeed * dt;
          // Pulled taut: the middle can't get more than this far ahead, it drags the sides.
          const slack = width * 0.45;
          if (side - middle > slack) {
            side = middle + slack;
            sideSpeed = dt > 0 ? (middle - previous) / dt : sideSpeed;
          }
          draw();
          if (cancelled || (middle <= top && side < -40) || elapsed > 1.8) {
            resolve();
          } else {
            frame = requestAnimationFrame(step);
          }
        };
        frame = requestAnimationFrame(step);
        track({ stop: () => cancelAnimationFrame(frame) });
      });

    const squash = async () => {
      const mask = part("mask");
      mask.style.transformOrigin = "50% 100%";
      // Crouch...
      await track(
        animate(
          mask,
          { scaleY: 0.76, scaleX: 1.16 },
          { duration: 0.2, ease: "easeOut" },
        ),
      );
      if (cancelled) return;
      // ...and jump, stretching on the way up and pulling the dark curtain with it.
      open();
      await Promise.all([
        track(
          animate(
            mask,
            { y: -height * 0.8, scaleY: 1.35, scaleX: 0.84 },
            { duration: 0.3, ease: [0.6, 0, 1, 0.25] },
          ),
        ),
        pullCurtain(),
      ]);
    };

    // The wink from "blink" as the wind-up, then the jump from "squash".
    const winkJump = async () => {
      await Promise.all([
        track(
          animate(
            part("eye-right"),
            { scaleY: [1, 0.08, 0.08, 1] },
            { duration: 0.34, times: [0, 0.3, 0.6, 1] },
          ),
        ),
        track(
          animate(
            part("mask"),
            { rotate: [0, -9, 0] },
            { duration: 0.4, ease: "easeInOut" },
          ),
        ),
      ]);
      if (cancelled) return;
      await squash();
    };

    const ripple = async () => {
      const center = { x: width / 2, y: height / 2 };
      const reach = Math.hypot(width, height) / 2 + 30;
      // The mask melts into a round drop...
      set("disc", { cx: center.x, cy: center.y, r: 48 });
      await Promise.all([
        track(
          animate(
            part("mask"),
            { scale: [1, 0.72], opacity: [1, 0] },
            { duration: 0.24, ease: "easeIn" },
          ),
        ),
        track(
          animate(
            part("disc"),
            { opacity: [0, 1] },
            { duration: 0.16, delay: 0.06 },
          ),
        ),
      ]);
      if (cancelled) return;
      // ...that ripples out, opening onto the app as the lime fades.
      open();
      await tween({ duration: 0.8, ease: [0.16, 0.8, 0.3, 1] }, (p) => {
        const r = lerp(48, reach, p);
        set("hole", { cx: center.x, cy: center.y, r: r * 0.97 });
        set("disc", { r, "fill-opacity": Math.max(0, 1 - p * 3) });
        set("ring", {
          cx: center.x,
          cy: center.y,
          r,
          "stroke-width": lerp(16, 2, p),
          opacity: Math.max(0, 1 - p * 1.1),
        });
        set("ring-trail", {
          cx: center.x,
          cy: center.y,
          r: r * 0.78,
          "stroke-width": lerp(8, 1, p),
          opacity: Math.max(0, 0.6 - p * 0.8),
        });
      });
    };

    const show = async () => {
      if (reduceMotion) {
        open();
        await track(animate(root, { opacity: 0 }, { duration: 0.25 }));
      } else if (variant === "button") await button();
      else if (variant === "squash") await squash();
      else if (variant === "winkjump") await winkJump();
      else if (variant === "ripple") await ripple();
      else await blink();
      if (!cancelled) finish();
    };
    void show();

    return () => {
      cancelled = true;
      running.forEach((controls) => controls.stop());
    };
  }, [play, variant, reduceMotion, size]);

  const { width, height } = size;

  return (
    <svg
      ref={svg}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] size-full"
    >
      <defs>
        <mask id={`${id}-hole`}>
          <rect width="100%" height="100%" fill="white" />
          <circle data-part="hole" r={0} fill="black" />
        </mask>
      </defs>
      <path
        data-part="backdrop"
        d={`M0 ${-height}H${width}V${height}H0Z`}
        fill={SPLASH_BACKGROUND}
        mask={`url(#${id}-hole)`}
      />
      <circle data-part="disc" r={0} fill={LIME} opacity={0} />
      <circle data-part="ring" r={0} fill="none" stroke={LIME} opacity={0} />
      <circle
        data-part="ring-trail"
        r={0}
        fill="none"
        stroke={LIME}
        opacity={0}
      />
      <g
        transform={`translate(${width / 2 - CANVAS / 2} ${height / 2 - CANVAS / 2})`}
      >
        <g data-part="mask" style={OWN_CENTER}>
          <g transform={MASK_TRANSFORM}>
            <path d={MASK_PATH} fill={LIME} />
            <g data-part="eye-left" style={OWN_CENTER}>
              <path d={LEFT_EYE} fill={PINK} transform="rotate(16 7.4 11.2)" />
            </g>
            <g data-part="eye-right" style={OWN_CENTER}>
              <path
                d={RIGHT_EYE}
                fill={PINK}
                transform="rotate(-16 16.6 11.2)"
              />
            </g>
          </g>
        </g>
      </g>
      <rect data-part="pill" fill={LIME} opacity={0} />
    </svg>
  );
}

export { SplashPrototypes };
