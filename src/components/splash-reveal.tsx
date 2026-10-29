import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
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

export type SplashVariant = "split" | "glance";

// CSS transforms on these groups move them around their own middle.
const OWN_CENTER = {
  transformBox: "fill-box",
  transformOrigin: "center",
} as const;

type SplashRevealProps = {
  variant: SplashVariant;
  // Starts the show; until then it sits still, looking just like the native splash.
  play: boolean;
  // The mask starts leaving: time for the app to animate in behind it.
  onOpen: () => void;
  onDone: () => void;
};

// Takes over from the native splash and lets the mask act out its exit.
function SplashReveal({ variant, play, onOpen, onDone }: SplashRevealProps) {
  const id = useId();
  const reduceMotion = useReducedMotion();
  const open = useEffectEvent(onOpen);
  const finish = useEffectEvent(onDone);
  const svg = useRef<SVGSVGElement>(null);
  const [center, setCenter] = useState(() => ({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }));

  useEffect(() => {
    const handleResize = () =>
      setCenter({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const root = svg.current;
    if (!play || !root) return;
    const parts = (name: string) =>
      Array.from(root.querySelectorAll<SVGElement>(`[data-part="${name}"]`));
    const running: { stop: () => void }[] = [];
    const track = <T extends { stop: () => void }>(controls: T) => {
      running.push(controls);
      return controls;
    };
    let cancelled = false;

    const show = async () => {
      if (reduceMotion) {
        open();
        await track(animate(root, { opacity: 0 }, { duration: 0.25 }));
      } else if (variant === "split") {
        // Eyes narrow, the mask shudders, then it breaks in two and the halves swing away.
        await Promise.all([
          track(
            animate(
              parts("eyes"),
              { scaleY: [1, 0.3] },
              { duration: 0.16, ease: "easeOut" },
            ),
          ),
          track(
            animate(
              parts("mask"),
              { x: [0, -4, 4, -3, 2, 0] },
              { duration: 0.26, delay: 0.1, ease: "easeInOut" },
            ),
          ),
        ]);
        if (cancelled) return;
        // The crack lights up pink down the middle just before the halves part.
        await track(animate(parts("seam"), { opacity: 1 }, { duration: 0.08 }));
        if (cancelled) return;
        open();
        const width = window.innerWidth;
        const swing = { duration: 0.55, ease: [0.55, 0, 0.75, 0.2] } as const;
        await Promise.all([
          track(
            animate(parts("left"), { x: -width * 0.7, rotate: -14 }, swing),
          ),
          track(animate(parts("right"), { x: width * 0.7, rotate: 14 }, swing)),
        ]);
      } else {
        // A shifty look left and right, then the mask is pulled off and flung away.
        await track(
          animate(
            parts("eyes"),
            { x: [0, -1.5, -1.5, 1.5, 1.5, 0] },
            {
              duration: 0.5,
              times: [0, 0.16, 0.42, 0.58, 0.86, 1],
              ease: "easeInOut",
            },
          ),
        );
        if (cancelled) return;
        open();
        await Promise.all([
          track(
            animate(
              parts("mask"),
              {
                y: [0, 10, -window.innerHeight * 0.8],
                rotate: [0, 6, -32],
                scale: [1, 0.94, 1.3],
              },
              {
                duration: 0.55,
                times: [0, 0.22, 1],
                ease: ["easeOut", "easeIn"],
              },
            ),
          ),
          track(
            animate(
              parts("backdrop"),
              { opacity: 0 },
              { duration: 0.4, delay: 0.12 },
            ),
          ),
        ]);
      }
      if (!cancelled) finish();
    };
    void show();

    return () => {
      cancelled = true;
      running.forEach((controls) => controls.stop());
    };
  }, [play, variant, reduceMotion]);

  const layer = (
    <>
      <rect
        data-part="backdrop"
        width="100%"
        height="100%"
        fill={SPLASH_BACKGROUND}
      />
      <g transform={`translate(${center.x} ${center.y})`}>
        <g transform={`translate(${-CANVAS / 2} ${-CANVAS / 2})`}>
          <g data-part="mask" style={OWN_CENTER}>
            <g transform={MASK_TRANSFORM}>
              <path d={MASK_PATH} fill="#C6FF3D" />
              <g data-part="eyes" style={OWN_CENTER}>
                <path
                  d={LEFT_EYE}
                  fill="#FF4FA3"
                  transform="rotate(16 7.4 11.2)"
                />
                <path
                  d={RIGHT_EYE}
                  fill="#FF4FA3"
                  transform="rotate(-16 16.6 11.2)"
                />
              </g>
            </g>
          </g>
        </g>
      </g>
    </>
  );

  const seam = (
    <rect
      data-part="seam"
      x={center.x - 2}
      width={4}
      height="100%"
      fill="#FF4FA3"
      opacity={0}
    />
  );

  return (
    <svg
      ref={svg}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] size-full"
    >
      {variant === "split" ? (
        <>
          <defs>
            <clipPath id={`${id}-left`}>
              <rect width={center.x} height="100%" />
            </clipPath>
            <clipPath id={`${id}-right`}>
              <rect x={center.x} width={center.x} height="100%" />
            </clipPath>
          </defs>
          {/* Each half carries its side of the background and of the mask, plus its
              half of the pink seam along the crack. */}
          {/* Each half swings around its own middle (a group's box ignores its clip). */}
          <g
            data-part="left"
            style={{
              transformBox: "view-box",
              transformOrigin: `${center.x / 2}px ${center.y}px`,
            }}
          >
            <g clipPath={`url(#${id}-left)`}>
              {layer}
              {seam}
            </g>
          </g>
          <g
            data-part="right"
            style={{
              transformBox: "view-box",
              transformOrigin: `${center.x * 1.5}px ${center.y}px`,
            }}
          >
            <g clipPath={`url(#${id}-right)`}>
              {layer}
              {seam}
            </g>
          </g>
        </>
      ) : (
        layer
      )}
    </svg>
  );
}

export { SplashReveal };
