import React, { useEffect, useRef } from 'react';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
}

export const InteractiveBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let particles: Particle[] = [];
        let animationFrameId: number;
        let mouseX = -1000;
        let mouseY = -1000;

        const resizeCanvas = () => {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            initParticles();
        };

        const initParticles = () => {
            particles = [];
            const particleCount = 80;

            for (let i = 0; i < particleCount; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    size: Math.random() * 2 + 2,
                });
            }
        };

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Update and draw particles
            ctx.fillStyle = 'rgba(243, 113, 0, 0.6)';
            ctx.strokeStyle = 'rgba(243, 113, 0, 0.2)';

            particles.forEach((particle, i) => {
                // Calculate distance to mouse
                const dx = mouseX - particle.x;
                const dy = mouseY - particle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const connectDistance = 250;

                // Attraction to mouse when close
                if (distance < connectDistance && distance > 0) {
                    const force = (1 - distance / connectDistance) * 0.5;
                    particle.vx += dx * force * 0.0005;
                    particle.vy += dy * force * 0.0005;
                }

                // Apply gentle friction
                particle.vx *= 0.99;
                particle.vy *= 0.99;

                // Ensure minimum movement
                const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
                if (speed < 0.1) {
                    particle.vx += (Math.random() - 0.5) * 0.1;
                    particle.vy += (Math.random() - 0.5) * 0.1;
                }

                // Move
                particle.x += particle.vx;
                particle.y += particle.vy;

                // Bounce off edges
                if (particle.x < 0 || particle.x > canvas.width) {
                    particle.vx *= -1;
                    particle.x = Math.max(0, Math.min(canvas.width, particle.x));
                }
                if (particle.y < 0 || particle.y > canvas.height) {
                    particle.vy *= -1;
                    particle.y = Math.max(0, Math.min(canvas.height, particle.y));
                }

                // Draw particle with glow effect near cursor
                const glowIntensity = distance < connectDistance ? (1 - distance / connectDistance) : 0;
                if (glowIntensity > 0) {
                    ctx.shadowBlur = 15 * glowIntensity;
                    ctx.shadowColor = 'rgba(243, 113, 0, 0.8)';
                } else {
                    ctx.shadowBlur = 3;
                    ctx.shadowColor = 'rgba(243, 113, 0, 0.3)';
                }

                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size + glowIntensity * 3, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowBlur = 0;

                // Connect to mouse with thicker line when close
                if (distance < connectDistance) {
                    ctx.beginPath();
                    ctx.moveTo(particle.x, particle.y);
                    ctx.lineTo(mouseX, mouseY);
                    ctx.strokeStyle = `rgba(243, 113, 0, ${0.5 * (1 - distance / connectDistance)})`;
                    ctx.lineWidth = 2.5 * (1 - distance / connectDistance);
                    ctx.stroke();
                }

                // Connect to nearby particles
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx2 = p2.x - particle.x;
                    const dy2 = p2.y - particle.y;
                    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

                    if (dist2 < 150) {
                        ctx.beginPath();
                        ctx.moveTo(particle.x, particle.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(243, 113, 0, ${0.2 * (1 - dist2 / 150)})`;
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                }
            });

            // Draw cursor glow
            if (mouseX > 0 && mouseY > 0 && mouseX < canvas.width && mouseY < canvas.height) {
                const gradient = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 150);
                gradient.addColorStop(0, 'rgba(243, 113, 0, 0.2)');
                gradient.addColorStop(1, 'rgba(243, 113, 0, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(mouseX - 150, mouseY - 150, 300, 300);
            }

            animationFrameId = requestAnimationFrame(draw);
        };

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        };

        const handleMouseLeave = () => {
            mouseX = -1000;
            mouseY = -1000;
        };

        window.addEventListener('resize', resizeCanvas);
        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('mouseleave', handleMouseLeave);

        resizeCanvas();
        draw();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            container.removeEventListener('mousemove', handleMouseMove);
            container.removeEventListener('mouseleave', handleMouseLeave);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden bg-background">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-500/5 via-background to-background" />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        </div>
    );
};
