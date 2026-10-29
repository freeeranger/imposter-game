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
const PINK = "#FF4FA3";

type Point = [number, number];

// Between the eyes the crack stays tight so the mask splits cleanly; past this distance
// from the middle it's free to wander.
const MASK_REACH = 52;

// One run of the crack from the middle of the screen out past one edge (direction -1 is up):
// uneven steps, sharp jags, and a sideways drift that sweeps it across the screen.
const crackRun = (width: number, height: number, direction: 1 | -1) => {
  const points: Point[] = [[width / 2, height / 2]];
  const maxDrift = width * 0.2;
  let drift = 0;
  let y = height / 2;
  while (y > -40 && y < height + 40) {
    y += direction * (14 + Math.random() * 42);
    const reach = Math.abs(y - height / 2);
    if (reach < MASK_REACH) {
      points.push([width / 2 + (Math.random() - 0.5) * 8, y]);
      continue;
    }
    const freedom = Math.min(1, (reach - MASK_REACH) / 90);
    drift += (Math.random() - 0.5) * 70 * freedom;
    drift = Math.max(-maxDrift, Math.min(maxDrift, drift));
    const jag = (Math.random() - 0.5) * 26 * freedom;
    points.push([width / 2 + drift + jag, y]);
  }
  return points;
};

// Short side cracks splitting off the main one, out into one of the halves.
const crackForks = (runs: Point[][]) =>
  runs.flatMap((run) =>
    run
      .filter(
        ([, y], index) =>
          index > 2 && index < run.length - 2 && Math.random() < 0.22 && y > 0,
      )
      .map(([x, y]) => {
        const side = Math.random() < 0.5 ? -1 : 1;
        const lean = Math.sign(y - run[0][1]) || 1;
        const fork: Point[] = [[x, y]];
        let [fx, fy] = [x, y];
        for (
          let step = 0;
          step < 2 + Math.floor(Math.random() * 3);
          step += 1
        ) {
          fx += side * (10 + Math.random() * 22);
          fy += lean * (4 + Math.random() * 18);
          fork.push([fx, fy]);
        }
        return fork;
      }),
  );

const makeCrack = (width: number, height: number) => {
  const up = crackRun(width, height, -1);
  const down = crackRun(width, height, 1);
  return { up, down, forks: crackForks([up, down]) };
};

const toPath = (points: Point[]) =>
  points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join("");

type SplashRevealProps = {
  // Starts the show; until then it sits still, looking just like the native splash.
  play: boolean;
  // The halves start parting: time for the app to animate in behind them.
  onOpen: () => void;
  onDone: () => void;
};

// Takes over from the native splash: the mask narrows its eyes, cracks down the middle,
// the crack races to the screen edges, and both halves break off and tumble away.
function SplashReveal({ play, onOpen, onDone }: SplashRevealProps) {
  const id = useId();
  const reduceMotion = useReducedMotion();
  const open = useEffectEvent(onOpen);
  const finish = useEffectEvent(onDone);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  // A new crack every launch.
  const [crack, setCrack] = useState(() =>
    makeCrack(window.innerWidth, window.innerHeight),
  );

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
      setCrack(makeCrack(window.innerWidth, window.innerHeight));
    };
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
        if (!cancelled) finish();
        return;
      }

      // Wind-up: the eyes narrow and the mask shudders.
      await Promise.all([
        track(
          animate(
            parts("eyes"),
            { scaleY: [1, 0.3] },
            { duration: 0.12, ease: "easeOut" },
          ),
        ),
        track(
          animate(
            parts("mask"),
            { x: [0, -3, 3, -2, 0] },
            { duration: 0.18, delay: 0.04, ease: "easeInOut" },
          ),
        ),
      ]);
      if (cancelled) return;

      // The crack starts between the eyes and races to the top and bottom of the screen,
      // splintering off to the sides as it goes.
      await Promise.all([
        track(
          animate(
            parts("crack"),
            { strokeDashoffset: [1, 0] },
            { duration: 0.22, ease: [0.5, 0, 1, 1] },
          ),
        ),
        track(
          animate(
            parts("fork"),
            { strokeDashoffset: [1, 0] },
            { duration: 0.08, delay: 0.14, ease: "easeOut" },
          ),
        ),
      ]);
      if (cancelled) return;

      // It breaks: the screen jolts, the halves snap a few pixels apart and hang there...
      open();
      const { width, height } = size;
      track(
        animate(
          root,
          { x: [0, -5, 4, -3, 2, 0], y: [0, 3, -3, 2, -1, 0] },
          { duration: 0.22, ease: "easeOut" },
        ),
      );
      await Promise.all([
        track(
          animate(
            parts("left"),
            { x: -7, rotate: -1.5 },
            { duration: 0.07, ease: "easeOut" },
          ),
        ),
        track(
          animate(
            parts("right"),
            { x: 7, rotate: 1.5 },
            { duration: 0.07, ease: "easeOut" },
          ),
        ),
      ]);
      await new Promise((resolve) => window.setTimeout(resolve, 110));
      if (cancelled) return;

      // ...then fall away outwards and down, tumbling as they go.
      const fall = { duration: 0.6, ease: [0.45, 0, 0.85, 0.35] } as const;
      await Promise.all([
        track(
          animate(
            parts("left"),
            { x: -width * 0.75, y: height * 0.55, rotate: -38 },
            fall,
          ),
        ),
        track(
          animate(
            parts("right"),
            { x: width * 0.75, y: height * 0.6, rotate: 42 },
            { ...fall, delay: 0.04 },
          ),
        ),
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
  const { up, down, forks } = crack;
  // The crack from top to bottom, which is the edge between the two halves.
  const crackLine = [...up].reverse().concat(down.slice(1));
  const leftHalf = [[-width, -height], ...crackLine, [-width, height * 2]];
  const rightHalf = [
    [width * 2, -height],
    ...crackLine,
    [width * 2, height * 2],
  ];
  const polygon = (points: number[][]) =>
    points.map((point) => point.join(",")).join(" ");

  const half = (side: "left" | "right", points: number[][]) => (
    <g
      data-part={side}
      style={{
        // Each half tumbles around its own middle (a group's box ignores its clip).
        transformBox: "view-box",
        transformOrigin: `${side === "left" ? width / 4 : (width * 3) / 4}px ${height / 2}px`,
      }}
    >
      <g clipPath={`url(#${id}-${side})`}>
        <rect width="100%" height="100%" fill={SPLASH_BACKGROUND} />
        <g
          transform={`translate(${width / 2 - CANVAS / 2} ${height / 2 - CANVAS / 2})`}
        >
          <g
            data-part="mask"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <g transform={MASK_TRANSFORM}>
              <path d={MASK_PATH} fill="#C6FF3D" />
              <g
                data-part="eyes"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              >
                <path
                  d={LEFT_EYE}
                  fill={PINK}
                  transform="rotate(16 7.4 11.2)"
                />
                <path
                  d={RIGHT_EYE}
                  fill={PINK}
                  transform="rotate(-16 16.6 11.2)"
                />
              </g>
            </g>
          </g>
        </g>
        {/* Each half shows its side of the pink crack, and the forks on its side. */}
        {[up, down].map((points, index) => (
          <path
            key={index}
            data-part="crack"
            d={toPath(points)}
            fill="none"
            stroke={PINK}
            strokeWidth={4}
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1}
          />
        ))}
        {forks.map((points, index) => (
          <path
            key={index}
            data-part="fork"
            d={toPath(points)}
            fill="none"
            stroke={PINK}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1}
          />
        ))}
      </g>
      <clipPath id={`${id}-${side}`}>
        <polygon points={polygon(points)} />
      </clipPath>
    </g>
  );

  return (
    <svg
      ref={svg}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] size-full"
    >
      {half("left", leftHalf)}
      {half("right", rightHalf)}
    </svg>
  );
}

export { SplashReveal };
