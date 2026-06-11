"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function ParallaxBackdrops() {
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Drift every grid backdrop slightly slower than the page scroll
      gsap.utils.toArray<HTMLElement>(".bg-grid, .bg-grid-fine").forEach((el) => {
        gsap.fromTo(
          el,
          { yPercent: -8, scale: 1.05 },
          {
            yPercent: 8,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              scrub: 1.2,
            },
          }
        );
      });

      // Radial fades pulse subtly via scroll
      gsap.utils.toArray<HTMLElement>(".bg-radial-fade").forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0.55, scale: 1 },
          {
            opacity: 1,
            scale: 1.15,
            ease: "sine.inOut",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          }
        );
      });
    });

    return () => ctx.revert();
  }, []);

  return null;
}
