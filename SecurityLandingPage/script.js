// Advanced Professional Landing Page Scripts
document.addEventListener('DOMContentLoaded', () => {
    initAdvancedLandingPage();
});

function initAdvancedLandingPage() {
    setupNavigation();
    setupAnimations();
    setupScrollEffects();
    setupCounters();
    setupParticleSystem();
    setupDashboardAnimations();
    setupInteractions();
}

// Enhanced Navigation System
function setupNavigation() {
    const nav = document.querySelector('.floating-nav');
    const navLinks = document.querySelectorAll('.nav-link');
    let lastScrollY = window.scrollY;

    // Floating nav scroll behavior
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        
        if (scrollY > 100) {
            nav.style.background = 'rgba(17, 24, 39, 0.95)';
            nav.style.borderColor = 'rgba(0, 229, 255, 0.2)';
        } else {
            nav.style.background = 'rgba(255, 255, 255, 0.05)';
            nav.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }

        // Keep nav visible - removed hide/show behavior
        nav.style.transform = 'translateX(-50%) translateY(0)';

        lastScrollY = scrollY;
    }, { passive: true });

    // Smooth scroll for navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                window.scrollTo({
                    top: target.offsetTop - 100,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Advanced Animation System
function setupAnimations() {
    // Button hover effects
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'translateY(-2px) scale(1.02)';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translateY(0) scale(1)';
        });
    });

    // Feature card animations
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-12px)';
            card.style.boxShadow = '0 25px 50px rgba(0, 229, 255, 0.3)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'none';
        });
    });

    // Intersection Observer for scroll animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.feature-card, .enterprise-feature, .dashboard-card').forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'all 0.8s ease';
        observer.observe(element);
    });
}

// Advanced Scroll Effects
function setupScrollEffects() {
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        
        // Parallax background elements
        const bgElements = document.querySelectorAll('.bg-gradient');
        bgElements.forEach(element => {
            element.style.transform = `translateY(${scrolled * -0.3}px)`;
        });

        // Dashboard 3D effect
        const dashboard = document.querySelector('.dashboard-mockup');
        if (dashboard) {
            const rect = dashboard.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            const mouseY = centerY - window.innerHeight / 2;
            const rotateX = (mouseY / window.innerHeight) * 5;
            
            dashboard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(-5deg)`;
        }
    }, { passive: true });
}

// Animated Counters
function setupCounters() {
    const counters = document.querySelectorAll('.stat-number, .metric-value');
    
    const animateCounter = (element) => {
        const target = element.textContent;
        const numericTarget = parseFloat(target.replace(/[^\d.]/g, ''));
        if (isNaN(numericTarget)) return;

        let current = 0;
        const increment = numericTarget / 50;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= numericTarget) {
                current = numericTarget;
                clearInterval(timer);
            }

            if (target.includes('%')) {
                element.textContent = current.toFixed(1) + '%';
            } else if (target.includes('ms')) {
                element.textContent = '<' + Math.floor(current) + 'ms';
            } else if (target.includes('/')) {
                element.textContent = '24/7';
            } else if (target.includes(',')) {
                element.textContent = Math.floor(current).toLocaleString() + (target.includes('+') ? '+' : '');
            } else {
                element.textContent = Math.floor(current).toString();
            }
        }, 40);
    };

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(counter => {
        counterObserver.observe(counter);
    });
}

// Dynamic Particle System
function setupParticleSystem() {
    const particleContainer = document.querySelector('.floating-particles');
    if (!particleContainer) return;

    const particles = [];
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: 2px;
            height: 2px;
            background: rgba(0, 229, 255, ${Math.random() * 0.5 + 0.1});
            border-radius: 50%;
            pointer-events: none;
        `;
        
        particleContainer.appendChild(particle);
        particles.push({
            element: particle,
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            life: Math.random() * 100
        });
    }

    const updateParticles = () => {
        particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life += 0.5;

            if (particle.life > 100) {
                particle.life = 0;
                particle.x = Math.random() * window.innerWidth;
                particle.y = Math.random() * window.innerHeight;
            }

            if (particle.x < 0 || particle.x > window.innerWidth) particle.vx *= -1;
            if (particle.y < 0 || particle.y > window.innerHeight) particle.vy *= -1;

            particle.element.style.transform = `translate(${particle.x}px, ${particle.y}px)`;
            particle.element.style.opacity = Math.sin(particle.life * 0.1) * 0.5 + 0.3;
        });

        requestAnimationFrame(updateParticles);
    };

    updateParticles();
}

// Security Interface Animation System
function setupDashboardAnimations() {
    // Animate threat dots
    const threatDots = document.querySelectorAll('.threat-dot');
    threatDots.forEach((dot, index) => {
        dot.style.opacity = '0';
        dot.style.transform = 'scale(0)';
        
        setTimeout(() => {
            dot.style.transition = 'all 0.5s ease';
            dot.style.opacity = '1';
            dot.style.transform = 'scale(1)';
        }, index * 500 + 1000);
    });

    // Activity feed items animation
    const feedItems = document.querySelectorAll('.feed-item');
    feedItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
            item.style.transition = 'all 0.5s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        }, index * 200 + 2000);
    });

    // Stat items animation
    const statItems = document.querySelectorAll('.stat-item');
    statItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            item.style.transition = 'all 0.6s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        }, index * 150 + 1500);
    });

    // Security monitor entrance animation
    const securityMonitor = document.querySelector('.security-monitor');
    if (securityMonitor) {
        securityMonitor.style.opacity = '0';
        securityMonitor.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            securityMonitor.style.transition = 'all 0.8s ease';
            securityMonitor.style.opacity = '1';
            securityMonitor.style.transform = 'scale(1)';
        }, 500);
    }
}

// Advanced Interactions
function setupInteractions() {
    // Magnetic buttons
    document.querySelectorAll('.btn-primary, .btn-glass').forEach(button => {
        button.addEventListener('mousemove', (e) => {
            const rect = button.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            button.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translate(0, 0)';
        });
    });

    // Tilt cards
    document.querySelectorAll('.feature-card, .dashboard-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / centerY * -5;
            const rotateY = (x - centerX) / centerX * 5;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
        });
    });
}

// Discord Authentication
function loginWithDiscord() {
    // Set the login intent to go to MyServers after successful authentication
    sessionStorage.setItem('login_redirect_intent', 'myservers');

    const authUrl = (window.AppConfig && window.AppConfig.discord && window.AppConfig.discord.authUrl)
        ? window.AppConfig.discord.authUrl
        : `https://discord.com/api/oauth2/authorize?client_id=your_bot_client_id_here&redirect_uri=${encodeURIComponent(window.location.origin + '/MyServers/')}&response_type=token&scope=identify%20guilds`;
    window.location.href = authUrl;
}

// Performance optimization
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.body.classList.add('reduced-motion');
}