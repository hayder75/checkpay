import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { getGeometricBgEnabled } from './GeometricBgToggle';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    layer: number; // 0: background, 1: midground, 2: foreground
    pulseOffset: number;
}

export default function GeometricBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const animationFrameRef = useRef<number | undefined>(undefined);
    const { theme } = useTheme();
    const shouldShowRef = useRef(true);
    const [visible, setVisible] = useState(getGeometricBgEnabled());

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            setVisible(detail);
        };
        window.addEventListener('geometricBgChange', handler);
        return () => window.removeEventListener('geometricBgChange', handler);
    }, []);

    const maskRectsRef = useRef<DOMRect[]>([]);


    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const updateMaskRects = () => {
            const elements = document.querySelectorAll('[data-mask-background]');
            maskRectsRef.current = Array.from(elements).map(el => el.getBoundingClientRect());
        };

        const createParticles = () => {
            particlesRef.current = [];
            const particleCount = 95; // Your preferred high-impact density
            const padding = 60;

            const cols = 10;
            const rows = 10;
            const cellWidth = (canvas.width - padding * 2) / cols;
            const cellHeight = (canvas.height - padding * 2) / rows;

            for (let i = 0; i < particleCount; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const layer = Math.random() > 0.8 ? 2 : (Math.random() > 0.4 ? 1 : 0);

                particlesRef.current.push({
                    x: padding + (col * cellWidth) + (Math.random() * cellWidth),
                    y: padding + (row * cellHeight) + (Math.random() * cellHeight),
                    vx: (Math.random() - 0.5) * (0.13 + layer * 0.09), // Reduced speed by ~10% for a calmer feel
                    vy: (Math.random() - 0.5) * (0.13 + layer * 0.09),
                    size: layer === 2 ? Math.random() * 2 + 3 : (layer === 1 ? Math.random() * 1.5 + 1 : Math.random() * 0.5 + 0.3),
                    layer,
                    pulseOffset: Math.random() * Math.PI * 2,
                });
            }
        };

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            createParticles();
            updateMaskRects();
            
            // Update visibility check - hide on mobile (< 768px) or when window is resized (< 1400px)
            // This ensures it hides when browser is not full screen (typical full screen is 1920px, half is ~960px)
            // We use 1400px to catch most "resized" scenarios where it would be distracting
            const isMobile = window.innerWidth < 768;
            const isResized = window.innerWidth < 1400;
            shouldShowRef.current = !isMobile && !isResized;
            if (canvasRef.current) {
                canvasRef.current.style.display = shouldShowRef.current ? 'block' : 'none';
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('scroll', updateMaskRects, { passive: true });

        const handleMouseMove = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const noFollow = target.closest('[data-no-cursor-follow]');
            
            if (noFollow) {
                mouseRef.current = { x: -1000, y: -1000 };
            } else {
                mouseRef.current = { x: e.clientX, y: e.clientY };
            }
        };

        const handleMouseLeave = () => {
            mouseRef.current = { x: -1000, y: -1000 };
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseleave', handleMouseLeave);

        const animate = (time: number) => {
            // Skip animation if should not show
            if (!shouldShowRef.current) {
                animationFrameRef.current = requestAnimationFrame(animate);
                return;
            }

            const isDark = theme === 'dark';
            const orangeColor = '243, 113, 0';
            const accentColor = isDark ? '148, 163, 184' : '100, 116, 139';

            // Reset effects
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';

            // Background clear with slight trail
            ctx.fillStyle = isDark ? 'rgba(5, 7, 20, 0.2)' : 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const particles = particlesRef.current;
            const mouse = mouseRef.current;
            const maskRects = maskRectsRef.current;

            const getOpacityMultiplier = (x: number, y: number) => {
                for (const rect of maskRects) {
                    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                        return 0.05; // Even lower opacity in masked areas
                    }
                }
                return 1;
            };

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                const opacityMult = getOpacityMultiplier(p.x, p.y);

                // Inter-particle repulsion (keeps them dispersed)
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dxp = p.x - p2.x;
                    const dyp = p.y - p2.y;
                    const distP = Math.sqrt(dxp * dxp + dyp * dyp);
                    if (distP < 80) {
                        const forceP = (80 - distP) / 80;
                        const angleP = Math.atan2(dyp, dxp);
                        const push = forceP * 0.012;
                        p.vx += Math.cos(angleP) * push;
                        p.vy += Math.sin(angleP) * push;
                        p2.vx -= Math.cos(angleP) * push;
                        p2.vy -= Math.sin(angleP) * push;
                    }
                }

                // Mouse interaction
                const dx = mouse.x - p.x;
                const dy = mouse.y - p.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const maxRange = 250 * (p.layer + 1) / 3;

                if (distance < maxRange) {
                    const force = (maxRange - distance) / maxRange;
                    const angle = Math.atan2(dy, dx);
                    const pull = 0.03 * (p.layer + 1);
                    p.vx += Math.cos(angle) * force * pull;
                    p.vy += Math.sin(angle) * force * pull;
                }

                p.x += p.vx;
                p.y += p.vy;

                // Bounce
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

                p.vx *= 0.985;
                p.vy *= 0.985;

                // Triangular Mesh Filling (Your favorite part!)
                if (p.layer >= 1) {
                    for (let j = i + 1; j < particles.length; j++) {
                        const p2 = particles[j];
                        if (p2.layer < 1) continue;

                        const dMesh = Math.sqrt((p.x - p2.x) ** 2 + (p.y - p2.y) ** 2);
                        const limit = 140;

                        if (dMesh < limit) {
                            const lineOpacityMult = Math.min(opacityMult, getOpacityMultiplier(p2.x, p2.y));
                            const lineOpacity = (1 - dMesh / limit) * 0.12 * lineOpacityMult;
                            const isNearMouse = distance < 180 || Math.sqrt((mouse.x - p2.x) ** 2 + (mouse.y - p2.y) ** 2) < 180;

                            ctx.beginPath();
                            ctx.strokeStyle = isNearMouse ? `rgba(${orangeColor}, ${lineOpacity * 1.5})` : `rgba(${accentColor}, ${lineOpacity})`;
                            ctx.lineWidth = isNearMouse ? 0.8 : 0.4;
                            ctx.moveTo(p.x, p.y);
                            ctx.lineTo(p2.x, p2.y);
                            ctx.stroke();

                            // Triangular Filling
                            for (let k = j + 1; k < particles.length; k++) {
                                const p3 = particles[k];
                                if (p3.layer < 1) continue;
                                const d2 = Math.sqrt((p2.x - p3.x) ** 2 + (p2.y - p3.y) ** 2);
                                const d3 = Math.sqrt((p.x - p3.x) ** 2 + (p.y - p3.y) ** 2);

                                if (d2 < limit && d3 < limit) {
                                    const triOpacityMult = Math.min(lineOpacityMult, getOpacityMultiplier(p3.x, p3.y));
                                    ctx.beginPath();
                                    ctx.moveTo(p.x, p.y);
                                    ctx.lineTo(p2.x, p2.y);
                                    ctx.lineTo(p3.x, p3.y);
                                    ctx.closePath();
                                    const fillOpacity = (isNearMouse ? 0.04 : 0.02) * triOpacityMult;
                                    ctx.fillStyle = isNearMouse ? `rgba(${orangeColor}, ${fillOpacity})` : `rgba(${accentColor}, ${fillOpacity})`;
                                    ctx.fill();
                                }
                            }

                            // Data Pulse
                            if (isNearMouse && Math.sin(time / 800 + p.pulseOffset) > 0.96) {
                                const t = (Math.sin(time / 300 + p.pulseOffset) + 1) / 2;
                                ctx.beginPath();
                                ctx.arc(p.x + (p2.x - p.x) * t, p.y + (p2.y - p.y) * t, 1.2, 0, Math.PI * 2);
                                ctx.fillStyle = `rgba(${orangeColor}, ${0.7 * lineOpacityMult})`;
                                ctx.fill();
                            }
                        }
                    }
                }

                // Draw Dot
                const glow = distance < 180 ? (1 - distance / 180) : 0;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size + (glow * 1.5), 0, Math.PI * 2);
                if (glow > 0) {
                    ctx.fillStyle = `rgba(${orangeColor}, ${(0.3 + glow * 0.7) * opacityMult})`;
                    ctx.shadowBlur = 8 * glow * opacityMult;
                    ctx.shadowColor = `rgba(${orangeColor}, ${0.4 * opacityMult})`;
                } else {
                    ctx.fillStyle = isDark ? `rgba(${accentColor}, ${(0.15 + p.layer * 0.15) * opacityMult})` : `rgba(0,0,0, ${(0.1 + p.layer * 0.1) * opacityMult})`;
                    ctx.shadowBlur = 0;
                }
                ctx.fill();
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            window.removeEventListener('scroll', updateMaskRects);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseleave', handleMouseLeave);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [theme]);

    // Initial visibility check on mount
    useEffect(() => {
        const checkInitialVisibility = () => {
            const isMobile = window.innerWidth < 768;
            const isResized = window.innerWidth < 1400;
            shouldShowRef.current = !isMobile && !isResized && visible;
            if (canvasRef.current) {
                canvasRef.current.style.display = shouldShowRef.current ? 'block' : 'none';
            }
        };
        checkInitialVisibility();
    }, []);

    // Sync visibility when toggle changes
    useEffect(() => {
        const isMobile = window.innerWidth < 768;
        const isResized = window.innerWidth < 1400;
        shouldShowRef.current = !isMobile && !isResized && visible;
        if (canvasRef.current) {
            canvasRef.current.style.display = shouldShowRef.current ? 'block' : 'none';
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-0 hidden xl:block"
            style={{ background: 'transparent' }}
        />
    );
}
