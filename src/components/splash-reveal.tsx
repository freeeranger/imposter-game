import { useEffect, useEffectEvent, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

// Same mask as the Android splash (android/app/src/main/res/drawable/splash_mask_animated.xml):
// a 288dp canvas centred on the screen, the mask scaled 7.5x inside it. One dp is one CSS
// pixel in the web view, so drawn the same way here it lines up with the native splash exactly.
const CANVAS = 288;
const MASK_TRANSFORM = "translate(54 53.75) scale(7.5)";
const MASK_PATH =
  "M4,6a2,2 0 0,0 -2,2v4a5,5 0 0,0 5,5 8,8 0 0,1 5,2 8,8 0 0,1 5,-2 5,5 0 0,0 5,-5V8a2,2 0 0,0 -2,-2h-3a8,8 0 0,0 -5,2 8,8 0 0,0 -5,-2z";
const LEFT_EYE = "M4.9,11.2a2.5,1.35 0 1,0 5,0a2.5,1.35 0 1,0 -5,0z";
const RIGHT_EYE = "M14.1,11.2a2.5,1.35 0 1,0 5,0a2.5,1.35 0 1,0 -5,0z";
const SPLASH_BACKGROUND = "#15111f";
const LIME = "#C6FF3D";
const PINK = "#FF4FA3";

// CSS transforms on these groups move them around their own middle.
const OWN_CENTER = {
  transformBox: "fill-box",
  transformOrigin: "center",
} as const;

const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

type SplashRevealProps = {
  // Starts the show; until then it sits still, looking just like the native splash.
  play: boolean;
  // The mask takes off: time for the app to animate in behind the curtain.
  onOpen: () => void;
  onDone: () => void;
};

// Takes over from the native splash: the mask winks, crouches and jumps off the top of the
// screen, pulling the dark background up after it like a curtain.
function SplashReveal({ play, onOpen, onDone }: SplashRevealProps) {
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
    const running: { stop: () => void }[] = [];
    const track = <T extends { stop: () => void }>(controls: T) => {
      running.push(controls);
      return controls;
    };
    let cancelled = false;
    const { width, height } = size;

    // The curtain behaves like fabric: the middle of its bottom edge is dragged up behind
    // the jumping mask, while the sides are springs that hang back, get yanked after it and
    // overshoot a little, so the edge wobbles on its way off the top.
    const pullCurtain = () =>
      new Promise<void>((resolve) => {
        const lift = 0.3;
        const top = -height * 0.35;
        // Pulled taut: the middle can't get more than this far ahead, it drags the sides.
        const slack = width * 0.45;
        let middle = height;
        let side = height;
        let sideSpeed = 0;
        let elapsed = 0;
        let last = performance.now();
        let frame = 0;
        const step = (now: number) => {
          // Small steps keep the spring steady even if a frame comes late.
          const dt = Math.min(0.032, (now - last) / 1000);
          last = now;
          elapsed += dt;
          // Accelerates all the way out: a gentle start, then it whips off the top.
          const previous = middle;
          middle = lerp(height, top, Math.min(1, elapsed / lift) ** 3.2);
          sideSpeed += (700 * (middle - side) - 32 * sideSpeed) * dt;
          side += sideSpeed * dt;
          if (side - middle > slack) {
            side = middle + slack;
            sideSpeed = dt > 0 ? (middle - previous) / dt : sideSpeed;
          }
          part("curtain").setAttribute(
            "d",
            `M0 ${-height}H${width}V${side}` +
              // A rounded bell: soft shoulders at the sides, a broad top in the middle.
              `C${width * 0.8} ${side} ${width * 0.72} ${middle} ${width / 2} ${middle}` +
              `C${width * 0.28} ${middle} ${width * 0.2} ${side} 0 ${side}Z`,
          );
          if (cancelled || (middle <= top && side < -40) || elapsed > 1.8) {
            resolve();
          } else {
            frame = requestAnimationFrame(step);
          }
        };
        frame = requestAnimationFrame(step);
        track({ stop: () => cancelAnimationFrame(frame) });
      });

    const show = async () => {
      if (reduceMotion) {
        open();
        await track(animate(root, { opacity: 0 }, { duration: 0.25 }));
        if (!cancelled) finish();
        return;
      }

      const mask = part("mask");
      // A wink with a little head tilt...
      await Promise.all([
        track(
          animate(
            part("right-eye"),
            { scaleY: [1, 0.08, 0.08, 1] },
            { duration: 0.34, times: [0, 0.3, 0.6, 1] },
          ),
        ),
        track(
          animate(
            mask,
            { rotate: [0, -9, 0] },
            { duration: 0.4, ease: "easeInOut" },
          ),
        ),
      ]);
      if (cancelled) return;

      // ...a crouch...
      mask.style.transformOrigin = "50% 100%";
      await track(
        animate(
          mask,
          { scaleY: 0.76, scaleX: 1.16 },
          { duration: 0.2, ease: "easeOut" },
        ),
      );
      if (cancelled) return;

      // ...and a jump, stretching on the way up and pulling the curtain with it.
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
      if (!cancelled) finish();
    };
    void show();

    return () => {
      cancelled = true;
      running.forEach((controls) => controls.stop());
    };
  }, [play, reduceMotion, size]);

  const { width, height } = size;

  return (
    <svg
      ref={svg}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] size-full"
    >
      <path
        data-part="curtain"
        d={`M0 ${-height}H${width}V${height}H0Z`}
        fill={SPLASH_BACKGROUND}
      />
      <g
        transform={`translate(${width / 2 - CANVAS / 2} ${height / 2 - CANVAS / 2})`}
      >
        <g data-part="mask" style={OWN_CENTER}>
          <g transform={MASK_TRANSFORM}>
            <path d={MASK_PATH} fill={LIME} />
            <path d={LEFT_EYE} fill={PINK} transform="rotate(16 7.4 11.2)" />
            <g data-part="right-eye" style={OWN_CENTER}>
              <path
                d={RIGHT_EYE}
                fill={PINK}
                transform="rotate(-16 16.6 11.2)"
              />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

export { SplashReveal };
