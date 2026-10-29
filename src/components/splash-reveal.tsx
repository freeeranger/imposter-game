import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { animate, motionValue, useReducedMotion } from "motion/react";

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
// Big enough that the hole covers any screen, notches and all.
const END_SCALE = 40;

const maskTransform = (scale: number) =>
  `scale(${scale}) translate(${-CANVAS / 2} ${-CANVAS / 2})`;

type SplashRevealProps = {
  // Starts the reveal; until then it sits still, looking just like the native splash.
  play: boolean;
  onDone: () => void;
};

// Takes over from the native splash: the mask dips, turns into a hole, and rushes towards
// the screen until the app behind it fills the view.
function SplashReveal({ play, onDone }: SplashRevealProps) {
  const holeId = useId();
  const finish = useEffectEvent(onDone);
  const reduceMotion = useReducedMotion();
  const svg = useRef<SVGSVGElement>(null);
  const hole = useRef<SVGGElement>(null);
  const face = useRef<SVGGElement>(null);
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
    if (!play) return;
    if (reduceMotion) {
      const fade = animate(1, 0, {
        duration: 0.25,
        onUpdate: (opacity) =>
          svg.current?.setAttribute("opacity", `${opacity}`),
        onComplete: finish,
      });
      return () => fade.stop();
    }
    const scale = motionValue(1);
    const faceOpacity = motionValue(1);
    scale.on("change", (value) => {
      hole.current?.setAttribute("transform", maskTransform(value));
      face.current?.setAttribute("transform", maskTransform(value));
    });
    faceOpacity.on("change", (value) =>
      face.current?.setAttribute("opacity", `${value}`),
    );
    const zoom = animate(scale, [1, 0.86, END_SCALE], {
      duration: 0.78,
      times: [0, 0.24, 1],
      ease: ["easeOut", [0.6, 0, 0.9, 0.3]],
      onComplete: finish,
    });
    // The lime face fades just as the dip bottoms out, opening the hole onto the app.
    const open = animate(faceOpacity, [1, 1, 0], {
      duration: 0.34,
      times: [0, 0.5, 1],
      ease: "easeOut",
    });
    return () => {
      zoom.stop();
      open.stop();
      scale.destroy();
      faceOpacity.destroy();
    };
  }, [play, reduceMotion]);

  const mask = (
    <>
      <path d={MASK_PATH} />
      <path d={LEFT_EYE} transform="rotate(16 7.4 11.2)" />
      <path d={RIGHT_EYE} transform="rotate(-16 16.6 11.2)" />
    </>
  );

  return (
    <svg
      ref={svg}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] size-full"
    >
      <defs>
        <mask id={holeId}>
          <rect width="100%" height="100%" fill="white" />
          <g transform={`translate(${center.x} ${center.y})`}>
            <g ref={hole} transform={maskTransform(1)}>
              <g transform={MASK_TRANSFORM} fill="black">
                {mask}
              </g>
            </g>
          </g>
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill={SPLASH_BACKGROUND}
        mask={`url(#${holeId})`}
      />
      <g transform={`translate(${center.x} ${center.y})`}>
        <g ref={face} transform={maskTransform(1)}>
          <g transform={MASK_TRANSFORM}>
            <path d={MASK_PATH} fill="#C6FF3D" />
            <path d={LEFT_EYE} fill="#FF4FA3" transform="rotate(16 7.4 11.2)" />
            <path
              d={RIGHT_EYE}
              fill="#FF4FA3"
              transform="rotate(-16 16.6 11.2)"
            />
          </g>
        </g>
      </g>
    </svg>
  );
}

export { SplashReveal };
