import React, { useState, useEffect } from "react";
import { motion } from "motion/react";

interface TypingTextProps {
  text: string;
  speed?: number; // milliseconds per character
  onComplete?: () => void;
}

export const TypingText: React.FC<TypingTextProps> = ({ 
  text, 
  speed = 10, 
  onComplete 
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Reset if text changes
    setDisplayedText("");
    setCurrentIndex(0);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    } else {
      if (onComplete) {
        onComplete();
      }
    }
  }, [currentIndex, text, speed, onComplete]);

  // Click to skip typing animation
  const handleSkip = () => {
    if (currentIndex < text.length) {
      setDisplayedText(text);
      setCurrentIndex(text.length);
      if (onComplete) onComplete();
    }
  };

  return (
    <span 
      onClick={handleSkip} 
      className="cursor-pointer active:scale-[0.99] select-text transition-transform"
      title="Click to instantly skip typing animation"
    >
      {displayedText}
      {currentIndex < text.length && (
        <motion.span
          animate={{ opacity: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="inline-block w-1.5 h-3.5 bg-indigo-400 ml-1 rounded-sm align-middle"
        />
      )}
    </span>
  );
};
