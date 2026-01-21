'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useCallback } from 'react';

interface AnimatedAvatarProps {
  isLoading?: boolean;
  isSpeaking?: boolean;
  platformColor?: string;
  size?: 'sm' | 'md' | 'lg';
  onHover?: () => void;
}

export default function AnimatedAvatar({
  isLoading = false,
  isSpeaking = false,
  platformColor = '#10B981',
  size = 'md',
  onHover,
}: AnimatedAvatarProps) {
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [mood, setMood] = useState<'neutral' | 'happy' | 'thinking'>('neutral');

  // Size configurations
  const sizes = {
    sm: { container: 60, eye: 14, pupil: 7, statusDot: 12 },
    md: { container: 80, eye: 20, pupil: 10, statusDot: 16 },
    lg: { container: 120, eye: 28, pupil: 14, statusDot: 20 },
  };

  const s = sizes[size];

  // Natural blinking at random intervals
  useEffect(() => {
    const blink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    };

    const scheduleNextBlink = () => {
      const delay = 2000 + Math.random() * 4000; // 2-6 seconds
      return setTimeout(() => {
        blink();
        scheduleNextBlink();
      }, delay);
    };

    const timeout = scheduleNextBlink();
    return () => clearTimeout(timeout);
  }, []);

  // Double blink occasionally
  useEffect(() => {
    const doubleBlink = setInterval(() => {
      if (Math.random() > 0.7) {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          setTimeout(() => {
            setIsBlinking(true);
            setTimeout(() => setIsBlinking(false), 100);
          }, 100);
        }, 100);
      }
    }, 8000);

    return () => clearInterval(doubleBlink);
  }, []);

  // Eye tracking with smooth movement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 4;

      const deltaX = (e.clientX - centerX) / centerX;
      const deltaY = (e.clientY - centerY) / centerY;

      // Limit movement range
      const maxMove = 4;
      setEyePosition({
        x: Math.max(-maxMove, Math.min(maxMove, deltaX * maxMove)),
        y: Math.max(-maxMove, Math.min(maxMove, deltaY * maxMove)),
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Update mood based on state
  useEffect(() => {
    if (isLoading) {
      setMood('thinking');
    } else if (isSpeaking) {
      setMood('happy');
    } else {
      setMood('neutral');
    }
  }, [isLoading, isSpeaking]);

  // Speaking bounce animation values
  const speakingScale = isSpeaking ? [1, 1.02, 1] : 1;

  // Get status color and text
  const getStatusInfo = useCallback(() => {
    if (isSpeaking) return { color: '#8B5CF6', text: 'Speaking...' };
    if (isLoading) return { color: '#F59E0B', text: 'Thinking...' };
    return { color: '#10B981', text: 'Online' };
  }, [isSpeaking, isLoading]);

  const statusInfo = getStatusInfo();

  return (
    <motion.div
      className="relative"
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        y: [0, -3, 0],
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onHoverStart={onHover}
      transition={{
        scale: { type: 'spring', stiffness: 260, damping: 20 },
        opacity: { duration: 0.3 },
        y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      {/* Outer glow ring - animated */}
      <motion.div
        className="absolute -inset-3 rounded-full blur-md"
        animate={{
          opacity: [0.2, 0.4, 0.2],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{ backgroundColor: platformColor }}
      />

      {/* Secondary pulse ring when speaking */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            className="absolute -inset-4 rounded-full"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{
              scale: [1, 1.3, 1.5],
              opacity: [0.4, 0.2, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: 'easeOut',
            }}
            style={{ backgroundColor: platformColor }}
          />
        )}
      </AnimatePresence>

      {/* Main avatar container */}
      <motion.div
        className="relative rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-300 flex items-center justify-center overflow-hidden shadow-lg"
        style={{ width: s.container, height: s.container }}
        animate={{ scale: speakingScale }}
        transition={isSpeaking ? { duration: 0.3, repeat: Infinity, ease: 'easeInOut' } : {}}
      >
        {/* Face plate */}
        <div
          className="absolute rounded-full bg-white flex items-center justify-center shadow-inner"
          style={{
            inset: s.container * 0.1,
          }}
        >
          {/* Eyes container */}
          <div className="flex" style={{ gap: s.eye * 0.6 }}>
            {/* Left eye */}
            <motion.div
              className="relative rounded-full bg-gray-100 overflow-hidden shadow-inner"
              style={{ width: s.eye, height: s.eye }}
              animate={{
                scaleY: isBlinking ? 0.1 : 1,
                scaleX: isBlinking ? 1.1 : 1,
              }}
              transition={{
                duration: 0.1,
                ease: 'easeInOut',
              }}
            >
              {/* Pupil */}
              <motion.div
                className="absolute rounded-full"
                style={{
                  width: s.pupil,
                  height: s.pupil,
                  backgroundColor: platformColor,
                  boxShadow: `0 0 8px ${platformColor}`,
                }}
                animate={{
                  left: `calc(50% + ${eyePosition.x}px - ${s.pupil / 2}px)`,
                  top: `calc(50% + ${eyePosition.y}px - ${s.pupil / 2}px)`,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 20,
                }}
              >
                {/* Inner pupil */}
                <div
                  className="absolute rounded-full bg-gray-900"
                  style={{ inset: s.pupil * 0.2 }}
                />
                {/* Highlight */}
                <motion.div
                  className="absolute rounded-full bg-white"
                  style={{
                    width: s.pupil * 0.3,
                    height: s.pupil * 0.3,
                    top: s.pupil * 0.15,
                    right: s.pupil * 0.15,
                  }}
                  animate={{
                    opacity: [0.8, 1, 0.8],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </motion.div>
            </motion.div>

            {/* Right eye */}
            <motion.div
              className="relative rounded-full bg-gray-100 overflow-hidden shadow-inner"
              style={{ width: s.eye, height: s.eye }}
              animate={{
                scaleY: isBlinking ? 0.1 : 1,
                scaleX: isBlinking ? 1.1 : 1,
              }}
              transition={{
                duration: 0.1,
                ease: 'easeInOut',
              }}
            >
              {/* Pupil */}
              <motion.div
                className="absolute rounded-full"
                style={{
                  width: s.pupil,
                  height: s.pupil,
                  backgroundColor: platformColor,
                  boxShadow: `0 0 8px ${platformColor}`,
                }}
                animate={{
                  left: `calc(50% + ${eyePosition.x}px - ${s.pupil / 2}px)`,
                  top: `calc(50% + ${eyePosition.y}px - ${s.pupil / 2}px)`,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 20,
                }}
              >
                {/* Inner pupil */}
                <div
                  className="absolute rounded-full bg-gray-900"
                  style={{ inset: s.pupil * 0.2 }}
                />
                {/* Highlight */}
                <motion.div
                  className="absolute rounded-full bg-white"
                  style={{
                    width: s.pupil * 0.3,
                    height: s.pupil * 0.3,
                    top: s.pupil * 0.15,
                    right: s.pupil * 0.15,
                  }}
                  animate={{
                    opacity: [0.8, 1, 0.8],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </motion.div>
            </motion.div>
          </div>

          {/* Thinking animation - loading dots under eyes */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                className="absolute flex gap-1"
                style={{ bottom: s.container * 0.15 }}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="rounded-full bg-amber-400"
                    style={{ width: s.pupil * 0.4, height: s.pupil * 0.4 }}
                    animate={{
                      y: [0, -3, 0],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status indicator */}
        <motion.div
          className="absolute bottom-0 right-0 rounded-full border-2 border-white"
          style={{
            width: s.statusDot,
            height: s.statusDot,
          }}
          animate={{
            backgroundColor: statusInfo.color,
            boxShadow: `0 0 8px ${statusInfo.color}`,
            scale: isSpeaking ? [1, 1.2, 1] : 1,
          }}
          transition={{
            scale: {
              duration: 0.5,
              repeat: isSpeaking ? Infinity : 0,
              ease: 'easeInOut',
            },
            backgroundColor: { duration: 0.3 },
          }}
        />
      </motion.div>
    </motion.div>
  );
}
