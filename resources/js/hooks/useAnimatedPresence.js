import { useEffect, useState } from "react";

function useAnimatedPresence(isOpen, options = {}) {
    const { exitDurationMs = 240 } = options;
    const [isRendered, setIsRendered] = useState(isOpen);
    const [isVisible, setIsVisible] = useState(isOpen);

    useEffect(() => {
        if (isOpen) {
            setIsRendered(true);
            let frameTwo = null;

            const frameOne = window.requestAnimationFrame(() => {
                frameTwo = window.requestAnimationFrame(() => {
                    setIsVisible(true);
                });
            });

            return () => {
                window.cancelAnimationFrame(frameOne);
                if (frameTwo) {
                    window.cancelAnimationFrame(frameTwo);
                }
            };
        }

        if (!isRendered) {
            return undefined;
        }

        setIsVisible(false);

        const timer = window.setTimeout(() => {
            setIsRendered(false);
        }, exitDurationMs);

        return () => window.clearTimeout(timer);
    }, [exitDurationMs, isOpen, isRendered]);

    return { isRendered, isVisible };
}

export default useAnimatedPresence;
