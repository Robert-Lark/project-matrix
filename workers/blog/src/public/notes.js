// Footnote hover-popovers — progressive enhancement inside the single-digit
// KB budget (ADR-0009 §7), served only on pages that carry footnotes. The
// anchor keeps working exactly as before; the popover mirrors content the
// reader can already reach at the anchor's target, so it stays aria-hidden
// and adds nothing to the screen-reader experience it duplicates.
//
// WCAG 1.4.13 (content on hover or focus): dismissible without moving the
// pointer (Esc), hoverable (the pointer may cross the gap onto the popover
// and read it under magnification), persistent (visible until unhover,
// blur, or explicit dismissal).

const refs = document.querySelectorAll("[data-footnote-ref]");

if (refs.length) {
  const pop = document.createElement("div");
  pop.className = "fn-popover";
  pop.setAttribute("aria-hidden", "true");
  pop.hidden = true;
  document.body.append(pop);

  let hideTimer = null;
  let shownFor = null;

  const hide = () => {
    clearTimeout(hideTimer);
    pop.hidden = true;
    shownFor = null;
  };

  const scheduleHide = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 180); // the grace that makes it hoverable
  };

  const show = (ref) => {
    const id = decodeURIComponent((ref.getAttribute("href") ?? "").slice(1));
    const note = document.getElementById(id);
    if (!note) return;
    clearTimeout(hideTimer);
    if (shownFor === ref && !pop.hidden) return;
    shownFor = ref;
    pop.replaceChildren(...note.cloneNode(true).childNodes);
    for (const back of pop.querySelectorAll("[data-footnote-backref]")) {
      back.remove();
    }
    pop.hidden = false;

    const doc = document.documentElement;
    pop.style.maxWidth = `${Math.min(384, doc.clientWidth - 24)}px`;
    const rect = ref.getBoundingClientRect();
    const fitsAbove = rect.top >= pop.offsetHeight + 12;
    const top = fitsAbove
      ? rect.top - pop.offsetHeight - 8
      : rect.bottom + 8;
    const left = Math.max(
      12,
      Math.min(
        rect.left + rect.width / 2 - pop.offsetWidth / 2,
        doc.clientWidth - pop.offsetWidth - 12,
      ),
    );
    pop.style.top = `${top + window.scrollY}px`;
    pop.style.left = `${left + window.scrollX}px`;
  };

  for (const ref of refs) {
    ref.addEventListener("mouseenter", () => show(ref));
    ref.addEventListener("mouseleave", scheduleHide);
    ref.addEventListener("focus", () => show(ref));
    ref.addEventListener("blur", hide);
  }
  pop.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  pop.addEventListener("mouseleave", scheduleHide);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });
}
