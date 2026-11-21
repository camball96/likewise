// Round icon buttons on product cards (heart, bookmark): grow a little on hover, squish when pressed,
// and when tapped on the icon springs in with a ring bursting out (keyframes in globals.css).
export const cardButton =
  "relative grid size-9 place-items-center rounded-full shadow transition duration-200 ease-out hover:scale-110 active:scale-90 motion-reduce:transition-none";
export const springIn = "motion-safe:animate-[spring_0.45s_ease-out]";
export const burstRing = "pointer-events-none absolute inset-0 rounded-full ring-2 motion-safe:animate-[burst_0.5s_ease-out_forwards] motion-reduce:hidden";
