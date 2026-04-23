import { animate, cleanInlineStyles, stagger } from "animejs";

const DEFAULT_REVEAL_SELECTOR = "[data-ua-motion-item]";
const DEFAULT_FLIP_DURATION = 760;
const DEFAULT_FLIP_EASE = "outExpo";

export const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const queryMotionElements = (container, selector) =>
    Array.from(container?.querySelectorAll(selector) || []);

export const captureElementRects = (elements, getKey) =>
    new Map(
        elements
            .map((element) => {
                const key = getKey(element);
                return key ? [key, element.getBoundingClientRect()] : null;
            })
            .filter(Boolean)
    );

export const cleanupMotion = (motion) => {
    if (!motion) {
        return;
    }

    if (motion.completed) {
        cleanInlineStyles(motion);
        return;
    }

    motion.revert();
};

export const stopMotion = (motion) => {
    if (!motion) {
        return;
    }

    if (typeof motion.pause === "function") {
        motion.pause();
    }
};

export const animateStaggerReveal = (container, options = {}) => {
    if (!container || prefersReducedMotion()) {
        return null;
    }

    const selector = options.selector || DEFAULT_REVEAL_SELECTOR;
    const targets = queryMotionElements(container, selector);

    if (targets.length === 0) {
        return null;
    }

    let motion = null;

    motion = animate(targets, {
        opacity: [0, 1],
        translateY: [22, 0],
        scale: [0.985, 1],
        delay: stagger(options.staggerMs ?? 65, { start: options.startDelayMs ?? 40 }),
        duration: options.duration ?? DEFAULT_FLIP_DURATION,
        ease: options.ease ?? DEFAULT_FLIP_EASE,
        onComplete: () => {
            if (motion) {
                cleanInlineStyles(motion);
            }
        },
    });

    return motion;
};

export const animateFlipMoves = (elements, previousRects, options = {}) => {
    if (!elements.length || !previousRects?.size || prefersReducedMotion()) {
        return [];
    }

    const getKey = options.getKey || ((element) => element.dataset.motionId);

    return elements
        .map((element) => {
            const key = getKey(element);
            const previousRect = key ? previousRects.get(key) : null;
            const nextRect = element.getBoundingClientRect();

            if (!previousRect) {
                return null;
            }

            const deltaX = previousRect.left - nextRect.left;
            const deltaY = previousRect.top - nextRect.top;

            if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
                return null;
            }

            let motion = null;

            motion = animate(element, {
                translateX: [deltaX, 0],
                translateY: [deltaY, 0],
                duration: options.duration ?? DEFAULT_FLIP_DURATION,
                ease: options.ease ?? DEFAULT_FLIP_EASE,
                onComplete: () => {
                    if (motion) {
                        cleanInlineStyles(motion);
                    }
                },
            });

            return motion;
        })
        .filter(Boolean);
};

export const animateValue = ({
    from = 0,
    to = 0,
    duration = 620,
    ease = DEFAULT_FLIP_EASE,
    onUpdate,
    onComplete,
}) => {
    const animatedValue = { value: from };

    return animate(animatedValue, {
        value: to,
        duration,
        ease,
        onUpdate: () => onUpdate?.(animatedValue.value),
        onComplete: () => onComplete?.(animatedValue.value),
    });
};
