"use client";

import { useEffect } from "react";

export function ParallaxMotion() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 767px)");
    if (reduceMotion.matches) return;

    document.documentElement.classList.add("motion-ready");
    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealNodes.forEach((node) => observer.observe(node));

    let frame = 0;
    const updateParallax = () => {
      frame = 0;
      if (mobile.matches) {
        document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((node) => {
          node.style.setProperty("--parallax-y", "0px");
        });
        return;
      }
      const viewportCenter = window.innerHeight / 2;
      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((node) => {
        const rect = node.getBoundingClientRect();
        const speed = Number(node.dataset.parallax ?? "0.08");
        const distance = Math.max(-64, Math.min(64, (rect.top + rect.height / 2 - viewportCenter) * speed));
        node.style.setProperty("--parallax-y", `${distance.toFixed(1)}px`);
      });
    };
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateParallax);
    };
    updateParallax();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
    mobile.addEventListener("change", requestUpdate);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      mobile.removeEventListener("change", requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
      document.documentElement.classList.remove("motion-ready");
    };
  }, []);

  return null;
}
