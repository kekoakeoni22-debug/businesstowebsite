-- Run this in Supabase → SQL Editor to seed (or update) the fallback
-- template used by the paywall mock-stream. Uses dollar-quoting ($html$)
-- so the HTML doesn't need any single-quote escaping.

insert into public.fallback_mock_template (id, html_template)
values ('default', $html$<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{BUSINESS_NAME}}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Jost:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
    <style>
        :root {
            --color-bg: #fdfbf8;
            --color-text: #2d3436;
            --color-primary: #4a5d4e;
            --color-accent: #b07d62;
            --color-muted: #718093;
            --font-heading: 'Playfair Display', serif;
            --font-body: 'Jost', sans-serif;
            --transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
            --shadow: 0 10px 30px rgba(0,0,0,0.05);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
            background-color: var(--color-bg);
            color: var(--color-text);
            font-family: var(--font-body);
            line-height: 1.6;
            overflow-x: hidden;
        }

        section { padding: 80px 24px; max-width: 1200px; margin: 0 auto; opacity: 0; transform: translateY(20px); transition: var(--transition); }
        section.visible { opacity: 1; transform: translateY(0); }

        h1, h2, h3 { font-family: var(--font-heading); font-weight: 500; line-height: 1.2; }
        p { margin-bottom: 1.5rem; color: var(--color-text); }
        a { text-decoration: none; transition: var(--transition); color: inherit; }

        header {
            position: sticky;
            top: 0;
            z-index: 1000;
            background: rgba(253, 251, 248, 0.95);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(0,0,0,0.05);
            padding: 1rem 24px;
        }
        .nav-container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-family: var(--font-heading); font-size: 1.5rem; font-weight: 700; color: var(--color-primary); }
        .nav-links { display: flex; gap: 2rem; }
        .nav-links a { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 500; }
        .nav-links a:hover { color: var(--color-accent); }
        .mobile-menu-btn { display: none; background: none; border: none; cursor: pointer; }

        .hero { display: grid; grid-template-columns: 1fr 1.2fr; align-items: center; min-height: 85vh; padding-top: 40px; gap: 60px; }
        .hero-content { z-index: 2; }
        .hero-tagline { color: var(--color-accent); text-transform: uppercase; letter-spacing: 3px; font-size: 0.85rem; font-weight: 600; margin-bottom: 1rem; display: block; }
        .hero h1 { font-size: clamp(2.5rem, 5vw, 4.5rem); margin-bottom: 1.5rem; color: var(--color-primary); }
        .rating-summary { display: flex; align-items: center; gap: 8px; margin-bottom: 2rem; font-weight: 500; }
        .rating-summary span { color: var(--color-muted); }
        .hero-btns { display: flex; gap: 1rem; flex-wrap: wrap; }
        .btn { padding: 16px 32px; border-radius: 50px; font-weight: 600; display: inline-flex; align-items: center; gap: 10px; cursor: pointer; }
        .btn-primary { background: var(--color-primary); color: white; }
        .btn-primary:hover { background: var(--color-accent); transform: translateY(-2px); box-shadow: 0 10px 20px rgba(176, 125, 98, 0.2); }
        .btn-secondary { border: 1px solid var(--color-primary); color: var(--color-primary); }
        .btn-secondary:hover { background: var(--color-primary); color: white; }

        .hero-image-container { position: relative; height: 100%; border-radius: 20px; overflow: hidden; box-shadow: var(--shadow); }
        .hero-img { width: 100%; height: 100%; object-fit: cover; }
        .hero-placeholder { position: absolute; inset: 0; background: linear-gradient(135deg, #e3e9e4 0%, #d4a373 100%); z-index: -1; }

        .about-grid { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 80px; align-items: start; }
        .about-title { position: sticky; top: 120px; }
        .about-text { font-size: 1.15rem; color: var(--color-text); }

        .services-header { text-align: center; margin-bottom: 4rem; }
        .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
        .service-card { background: white; padding: 40px; border-radius: 20px; box-shadow: var(--shadow); transition: var(--transition); border: 1px solid rgba(0,0,0,0.02); }
        .service-card:hover { transform: translateY(-10px); border-color: var(--color-accent); }
        .service-icon { width: 48px; height: 48px; margin-bottom: 1.5rem; color: var(--color-accent); }
        .service-card h3 { margin-bottom: 1rem; font-size: 1.5rem; color: var(--color-primary); }

        .gallery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
        .gallery-img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 12px; transition: var(--transition); }
        .gallery-img:hover { filter: brightness(0.9); }

        .reviews { background: #f4f1ee; max-width: 100%; }
        .reviews-container { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 3rem; }
        .review-card { position: relative; }
        .quote-icon { position: absolute; top: -20px; left: -20px; opacity: 0.1; width: 60px; height: 60px; }
        .review-text { font-family: var(--font-heading); font-size: 1.4rem; font-style: italic; margin-bottom: 1.5rem; position: relative; }
        .review-author { font-weight: 700; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 2px; color: var(--color-accent); }

        .map-section h2 { margin-bottom: 2rem; text-align: center; }
        .location-map { width: 100%; height: 450px; border: 0; border-radius: 20px; box-shadow: var(--shadow); display: block; }
        .address-under-map { margin-top: 1.5rem; text-align: center; font-weight: 500; }
        .address-under-map a:hover { color: var(--color-accent); }

        footer { background: var(--color-primary); color: white; padding: 80px 24px 40px; margin-top: 80px; }
        .footer-grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 60px; margin-bottom: 60px; }
        .footer-logo { font-family: var(--font-heading); font-size: 2rem; margin-bottom: 1.5rem; display: block; }
        .footer-title { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 1.5rem; opacity: 0.7; }
        .hours { list-style: none; font-family: monospace; font-size: 0.95rem; }
        .hours li { display: grid; grid-template-columns: 100px 1fr; margin-bottom: 0.5rem; }
        .contact-link { display: block; margin-bottom: 1rem; font-size: 1.1rem; }
        .contact-link:hover { opacity: 0.8; }
        .copyright { text-align: center; padding-top: 40px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem; opacity: 0.6; }

        @media (max-width: 968px) {
            .hero { grid-template-columns: 1fr; gap: 40px; text-align: center; }
            .hero-btns { justify-content: center; }
            .about-grid { grid-template-columns: 1fr; gap: 40px; }
            .about-title { position: static; }
            .footer-grid { grid-template-columns: 1fr; gap: 40px; }
            .nav-links { display: none; }
            .mobile-menu-btn { display: block; }
        }
    </style>
</head>
<body>

    <header>
        <div class="nav-container">
            <a class="logo" href="#top">{{BUSINESS_NAME}}</a>
            <nav class="nav-links">
                <a href="#about">About</a>
                <a href="#services">Services</a>
                <a href="#gallery">Gallery</a>
                <a href="#contact">Contact</a>
            </nav>
            <button class="mobile-menu-btn" aria-label="Menu">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
        </div>
    </header>

    <main id="top">
        <section class="hero visible">
            <div class="hero-content">
                <span class="hero-tagline">Welcome</span>
                <h1>{{BUSINESS_NAME}}</h1>
                <div class="rating-summary">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#f1c40f"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <strong>{{RATING}}</strong>
                    <span>· {{REVIEW_COUNT}} Google Reviews</span>
                </div>
                <p>A trusted local business serving the neighborhood with care, quality, and a personal touch. Stop in, give us a call, or get in touch to learn more.</p>
                <div class="hero-btns">
                    <a class="btn btn-primary" href="tel:{{PHONE}}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        {{PHONE}}
                    </a>
                    <a class="btn btn-secondary" href="#services">Learn More</a>
                </div>
            </div>
            <div class="hero-image-container">
                <div class="hero-placeholder"></div>
                <img class="hero-img" src="{{HERO_PHOTO_URL}}" alt="{{BUSINESS_NAME}}" onerror="this.style.display='none'" />
            </div>
        </section>

        <section id="about" class="about">
            <div class="about-grid">
                <div class="about-title">
                    <span class="hero-tagline">Our Story</span>
                    <h2>Built on Care</h2>
                </div>
                <div class="about-text">
                    <p>{{BUSINESS_NAME}} was founded on a simple idea: that the best local businesses are the ones that put people first. We treat every customer like a neighbor and every visit like the start of a long relationship.</p>
                    <p>From the team behind the counter to the details we sweat on every order, we take pride in the work and the community we serve. Walk in, give us a call, or send a message — we'd love to meet you.</p>
                </div>
            </div>
        </section>

        <section id="services">
            <div class="services-header">
                <h2>What We Offer</h2>
                <p>A few of the ways we help our customers every day.</p>
            </div>
            <div class="services-grid">
                <div class="service-card">
                    <svg class="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 6L9 17l-5-5"/></svg>
                    <h3>Quality You Can Trust</h3>
                    <p>Every order gets the same level of attention and craft. We don't cut corners — and our reviews back it up.</p>
                </div>
                <div class="service-card">
                    <svg class="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    <h3>Convenient Hours</h3>
                    <p>We're open when you need us. Check our hours below and stop by, or give us a call to plan ahead.</p>
                </div>
                <div class="service-card">
                    <svg class="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                    <h3>Personal Service</h3>
                    <p>You'll talk to a real person every time. Tell us what you need and we'll help you find the right fit.</p>
                </div>
            </div>
        </section>

        {{#PHOTO_1}}
        <section id="gallery" class="gallery">
            <div class="services-header">
                <h2>Our Space</h2>
                <p>A look around {{BUSINESS_NAME}}.</p>
            </div>
            <div class="gallery-grid">
                <img class="gallery-img" src="{{PHOTO_1}}" alt="{{BUSINESS_NAME}} photo 1" loading="lazy" />
                {{#PHOTO_2}}<img class="gallery-img" src="{{PHOTO_2}}" alt="{{BUSINESS_NAME}} photo 2" loading="lazy" />{{/PHOTO_2}}
                {{#PHOTO_3}}<img class="gallery-img" src="{{PHOTO_3}}" alt="{{BUSINESS_NAME}} photo 3" loading="lazy" />{{/PHOTO_3}}
                {{#PHOTO_4}}<img class="gallery-img" src="{{PHOTO_4}}" alt="{{BUSINESS_NAME}} photo 4" loading="lazy" />{{/PHOTO_4}}
                {{#PHOTO_5}}<img class="gallery-img" src="{{PHOTO_5}}" alt="{{BUSINESS_NAME}} photo 5" loading="lazy" />{{/PHOTO_5}}
                {{#PHOTO_6}}<img class="gallery-img" src="{{PHOTO_6}}" alt="{{BUSINESS_NAME}} photo 6" loading="lazy" />{{/PHOTO_6}}
            </div>
        </section>
        {{/PHOTO_1}}

        <section class="reviews">
            <div class="reviews-container">
                <div class="review-card">
                    <svg class="quote-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.899 14.899 16.017 16 16.017L19 16.017C19.552 16.017 20 15.569 20 15.017L20 9.017C20 8.465 19.552 8.017 19 8.017L15 8.017C14.448 8.017 14 7.569 14 7.017L14 4.017C14 3.465 14.448 3.017 15 3.017L21 3.017C21.552 3.017 22 3.465 22 4.017L22 15.017C22 18.339 19.339 21 16 21L14.017 21ZM4.017 21L4.017 18C4.017 16.899 4.899 16.017 6 16.017L9 16.017C9.552 16.017 10 15.569 10 15.017L10 9.017C10 8.465 9.552 8.017 9 8.017L5 8.017C4.448 8.017 4 7.569 4 7.017L4 4.017C4 3.465 4.448 3.017 5 3.017L11 3.017C11.552 3.017 12 3.465 12 4.017L12 15.017C12 18.339 9.339 21 6 21L4.017 21Z"/></svg>
                    <p class="review-text">Honestly the best in town. Friendly, professional, and they actually care about the people who walk through the door.</p>
                    <span class="review-author">— Elena</span>
                </div>
                <div class="review-card">
                    <p class="review-text">Great experience from start to finish. They went above and beyond what I expected — I'll definitely be back.</p>
                    <span class="review-author">— Marcus</span>
                </div>
            </div>
        </section>

        {{#MAP_EMBED_URL}}
        <section class="map-section">
            <h2>Find Us</h2>
            <iframe
                class="location-map"
                src="{{MAP_EMBED_URL}}"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
                title="Map showing the location of {{BUSINESS_NAME}}"
            ></iframe>
            <p class="address-under-map">
                <a href="{{ADDRESS_MAPS_URL}}" target="_blank" rel="noreferrer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {{ADDRESS}}
                </a>
            </p>
        </section>
        {{/MAP_EMBED_URL}}
    </main>

    <footer id="contact">
        <div class="footer-grid">
            <div class="footer-brand">
                <a class="footer-logo" href="#top">{{BUSINESS_NAME}}</a>
                <p>Thanks for stopping by. Give us a call or visit in person — we'd love to hear from you.</p>
                <a class="contact-link" href="tel:{{PHONE}}"><strong>{{PHONE}}</strong></a>
                <a class="contact-link" href="{{ADDRESS_MAPS_URL}}" target="_blank" rel="noreferrer">{{ADDRESS}}</a>
            </div>
            <div class="footer-hours">
                <p class="footer-title">Opening Hours</p>
                <ul class="hours">{{HOURS_LIST}}</ul>
            </div>
            <div class="footer-nav">
                <p class="footer-title">Explore</p>
                <nav style="display: flex; flex-direction: column; gap: 10px;">
                    <a href="#about">About</a>
                    <a href="#services">Services</a>
                    <a href="#gallery">Gallery</a>
                    <a href="tel:{{PHONE}}">Get in Touch</a>
                </nav>
            </div>
        </div>
        <div class="copyright">
            <p>&copy; <span id="year"></span> {{BUSINESS_NAME}}. All rights reserved.</p>
        </div>
    </footer>

    <script>
        document.getElementById('year').textContent = new Date().getFullYear();

        const observerOptions = { threshold: 0.1 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        document.querySelectorAll('section').forEach(section => observer.observe(section));

        const menuBtn = document.querySelector('.mobile-menu-btn');
        const navLinks = document.querySelector('.nav-links');

        menuBtn.addEventListener('click', () => {
            const isVisible = navLinks.style.display === 'flex';
            navLinks.style.display = isVisible ? 'none' : 'flex';
            if (!isVisible) {
                navLinks.style.flexDirection = 'column';
                navLinks.style.position = 'absolute';
                navLinks.style.top = '100%';
                navLinks.style.left = '0';
                navLinks.style.right = '0';
                navLinks.style.background = 'white';
                navLinks.style.padding = '2rem';
                navLinks.style.boxShadow = '0 10px 10px rgba(0,0,0,0.05)';
            }
        });
    </script>
</body>
</html>$html$)
on conflict (id) do update set
  html_template = excluded.html_template,
  updated_at = now();
