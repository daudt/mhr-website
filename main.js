document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu functionality
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navMenu = document.querySelector('.nav-menu');

    mobileMenuBtn.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        mobileMenuBtn.classList.toggle('active');
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-container')) {
            navMenu.classList.remove('active');
            mobileMenuBtn.classList.remove('active');
        }
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add scroll event listener for header
    const header = document.querySelector('.main-header');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll <= 0) {
            header.classList.remove('scroll-up');
            return;
        }

        if (currentScroll > lastScroll && !header.classList.contains('scroll-down')) {
            // Scroll Down
            header.classList.remove('scroll-up');
            header.classList.add('scroll-down');
        } else if (currentScroll < lastScroll && header.classList.contains('scroll-down')) {
            // Scroll Up
            header.classList.remove('scroll-down');
            header.classList.add('scroll-up');
        }
        lastScroll = currentScroll;
    });

    // Gallery Grid + Lightbox functionality
    const galleryGrid = document.getElementById('gallery-grid');
    const lightbox = document.getElementById('lightbox');

    console.log('Gallery elements:', { galleryGrid: !!galleryGrid, lightbox: !!lightbox });

    if (galleryGrid && lightbox) {
        let galleryImages = [];
        let currentImageIndex = 0;

        const lightboxImage = document.getElementById('lightbox-image');
        const lightboxCounter = document.getElementById('lightbox-counter');
        const lightboxClose = document.querySelector('.lightbox-close');
        const lightboxPrev = document.querySelector('.lightbox-prev');
        const lightboxNext = document.querySelector('.lightbox-next');

        // Fetch and display gallery images
        fetch('data/gallery.json')
            .then(response => {
                console.log('Gallery fetch response:', response.status);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(images => {
                console.log('Gallery images loaded:', images.length);
                galleryImages = images;

                images.forEach((image, index) => {
                    const item = document.createElement('div');
                    item.className = 'gallery-item';
                    item.dataset.index = index;

                    const img = document.createElement('img');
                    img.src = `images/gallery/${image}`;
                    img.alt = 'Mile High Runners Gallery Image';
                    img.loading = 'lazy'; // Native lazy loading

                    item.appendChild(img);
                    galleryGrid.appendChild(item);

                    // Click to open lightbox
                    item.addEventListener('click', () => openLightbox(index));
                });

                console.log(`Gallery loaded: ${images.length} images`);
            })
            .catch(err => {
                console.error('Error loading gallery:', err);
                galleryGrid.innerHTML = `<p style="color: red; padding: 2rem;">Error loading gallery: ${err.message}</p>`;
            });

        function openLightbox(index) {
            currentImageIndex = index;
            updateLightboxImage();
            lightbox.classList.add('active');
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }

        function closeLightbox() {
            lightbox.classList.remove('active');
            lightbox.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = ''; // Restore scrolling
        }

        function updateLightboxImage() {
            const image = galleryImages[currentImageIndex];
            lightboxImage.src = `images/gallery/${image}`;
            lightboxCounter.textContent = `${currentImageIndex + 1} / ${galleryImages.length}`;
        }

        function nextImage() {
            currentImageIndex = (currentImageIndex + 1) % galleryImages.length;
            updateLightboxImage();
        }

        function prevImage() {
            currentImageIndex = (currentImageIndex - 1 + galleryImages.length) % galleryImages.length;
            updateLightboxImage();
        }

        // Event listeners
        lightboxClose.addEventListener('click', closeLightbox);
        lightboxNext.addEventListener('click', nextImage);
        lightboxPrev.addEventListener('click', prevImage);

        // Close on background click
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox || e.target === document.querySelector('.lightbox-content')) {
                closeLightbox();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!lightbox.classList.contains('active')) return;

            if (e.key === 'Escape') {
                closeLightbox();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                nextImage();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prevImage();
            }
        });

        // Touch swipe support for mobile
        let touchStartX = 0;
        let touchEndX = 0;

        lightbox.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        lightbox.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            const swipeThreshold = 50;
            const diff = touchStartX - touchEndX;

            if (Math.abs(diff) > swipeThreshold) {
                if (diff > 0) {
                    nextImage(); // Swipe left = next
                } else {
                    prevImage(); // Swipe right = prev
                }
            }
        }
    }


    // EmailJS Configuration
    // Get these values from your EmailJS dashboard (https://dashboard.emailjs.com)
    const EMAILJS_CONFIG = {
        PUBLIC_KEY: '2ZqYNkVwSXVoSaaij',           // From Account > General
        SERVICE_ID: 'service_j6fkx5r',             // From Email Services
        TEMPLATE_ID: 'template_tvdy5dn',           // Contact form template
        NEWSLETTER_TEMPLATE_ID: 'template_2oex3ym'  // Newsletter signup template
    };

    // Initialize EmailJS
    if (typeof emailjs !== 'undefined' && EMAILJS_CONFIG.PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
        emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
    }

    // Newsletter form submission
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const emailInput = newsletterForm.querySelector('input[type="email"]');
            const email = emailInput.value;
            const submitButton = newsletterForm.querySelector('button[type="submit"]');

            // Check if EmailJS is configured
            if (!emailjs || EMAILJS_CONFIG.PUBLIC_KEY === 'YOUR_PUBLIC_KEY') {
                showNewsletterMessage('error', 'Newsletter service not configured. Please contact us directly.');
                return;
            }

            // Disable button and show loading
            submitButton.disabled = true;
            submitButton.textContent = 'Subscribing...';

            try {
                // Send notification email via EmailJS
                const response = await emailjs.send(
                    EMAILJS_CONFIG.SERVICE_ID,
                    EMAILJS_CONFIG.NEWSLETTER_TEMPLATE_ID,
                    {
                        subscriber_email: email,
                        signup_date: new Date().toLocaleString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                    }
                );

                if (response.status === 200) {
                    showNewsletterMessage('success', 'Thank you for subscribing! We\'ll keep you updated.');
                    newsletterForm.reset();
                } else {
                    throw new Error('Subscription failed');
                }
            } catch (error) {
                console.error('Newsletter subscription error:', error);
                showNewsletterMessage('error', 'Sorry, there was an error. Please try again later.');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Subscribe';
            }
        });

        function showNewsletterMessage(type, message) {
            // Remove any existing messages
            const existingMessage = newsletterForm.querySelector('.newsletter-message');
            if (existingMessage) {
                existingMessage.remove();
            }

            // Create and show new message
            const messageElement = document.createElement('p');
            messageElement.className = 'newsletter-message';
            messageElement.textContent = message;
            messageElement.style.color = type === 'success' ? '#2ecc71' : '#e74c3c';
            messageElement.style.marginTop = '1rem';
            messageElement.style.fontWeight = '600';
            newsletterForm.appendChild(messageElement);

            // Remove message after 5 seconds
            setTimeout(() => {
                messageElement.remove();
            }, 5000);
        }
    }

    // Contact Form Handling
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Clear previous errors
            clearFormErrors();
            hideFormMessage();

            // Validate form
            if (!validateForm()) {
                return;
            }

            // Verify CAPTCHA
            if (typeof grecaptcha === 'undefined') {
                showFieldError('captchaError', 'CAPTCHA not loaded. Please refresh the page.');
                return;
            }

            const captchaResponse = grecaptcha.getResponse();
            if (!captchaResponse) {
                showFieldError('captchaError', 'Please complete the CAPTCHA verification');
                return;
            }

            // Check if EmailJS is configured
            if (!emailjs || EMAILJS_CONFIG.PUBLIC_KEY === 'YOUR_PUBLIC_KEY') {
                showFormMessage('error', 'Email service not configured. Please contact us by phone at 303-396-5650.');
                return;
            }

            // Show loading state
            setFormLoading(true);

            try {
                // Prepare template parameters
                const templateParams = {
                    from_name: document.getElementById('name').value,
                    from_email: document.getElementById('email').value,
                    subject: document.getElementById('subject').value,
                    message: document.getElementById('message').value,
                    'g-recaptcha-response': captchaResponse
                };

                // Send email via EmailJS
                const response = await emailjs.send(
                    EMAILJS_CONFIG.SERVICE_ID,
                    EMAILJS_CONFIG.TEMPLATE_ID,
                    templateParams
                );

                if (response.status === 200) {
                    showFormMessage('success', 'Thank you! Your message has been sent successfully. We\'ll get back to you soon!');
                    contactForm.reset();
                    if (typeof grecaptcha !== 'undefined') {
                        grecaptcha.reset();
                    }
                } else {
                    throw new Error('Email sending failed');
                }
            } catch (error) {
                console.error('Form submission error:', error);
                showFormMessage('error', 'Sorry, there was an error sending your message. Please try again later or call us directly at 303-396-5650.');
            } finally {
                setFormLoading(false);
            }
        });

        function validateForm() {
            let isValid = true;

            // Validate name
            const name = document.getElementById('name').value.trim();
            if (!name || name.length < 2) {
                showFieldError('nameError', 'Please enter your name (at least 2 characters)');
                markFieldError('name');
                isValid = false;
            }

            // Validate email
            const email = document.getElementById('email').value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) {
                showFieldError('emailError', 'Please enter a valid email address');
                markFieldError('email');
                isValid = false;
            }

            // Validate subject
            const subject = document.getElementById('subject').value.trim();
            if (!subject || subject.length < 3) {
                showFieldError('subjectError', 'Please enter a subject (at least 3 characters)');
                markFieldError('subject');
                isValid = false;
            }

            // Validate message
            const message = document.getElementById('message').value.trim();
            if (!message || message.length < 10) {
                showFieldError('messageError', 'Please enter a message (at least 10 characters)');
                markFieldError('message');
                isValid = false;
            }

            return isValid;
        }

        function showFieldError(fieldId, message) {
            const errorElement = document.getElementById(fieldId);
            if (errorElement) {
                errorElement.textContent = message;
                errorElement.classList.add('show');
            }
        }

        function markFieldError(fieldId) {
            const field = document.getElementById(fieldId);
            if (field) {
                field.classList.add('error');
                field.addEventListener('input', function clearError() {
                    field.classList.remove('error');
                    const errorElement = document.getElementById(fieldId + 'Error');
                    if (errorElement) {
                        errorElement.classList.remove('show');
                    }
                    field.removeEventListener('input', clearError);
                });
            }
        }

        function clearFormErrors() {
            document.querySelectorAll('.error-message').forEach(error => {
                error.classList.remove('show');
                error.textContent = '';
            });
            document.querySelectorAll('.error').forEach(field => {
                field.classList.remove('error');
            });
        }

        function showFormMessage(type, message) {
            const messagesDiv = document.getElementById('formMessages');
            if (messagesDiv) {
                messagesDiv.textContent = message;
                messagesDiv.className = `form-messages ${type} show`;

                // Scroll to message
                messagesDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        function hideFormMessage() {
            const messagesDiv = document.getElementById('formMessages');
            if (messagesDiv) {
                messagesDiv.classList.remove('show');
            }
        }

        function setFormLoading(loading) {
            const submitButton = contactForm.querySelector('.submit-button');
            const submitText = document.getElementById('submitText');
            const submitSpinner = document.getElementById('submitSpinner');

            if (submitButton) {
                submitButton.disabled = loading;
            }
            if (submitText) {
                submitText.style.display = loading ? 'none' : 'inline';
            }
            if (submitSpinner) {
                submitSpinner.style.display = loading ? 'inline-block' : 'none';
            }
        }
    }

    // Race Results Tabs Functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    if (tabButtons.length > 0 && tabContents.length > 0) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Get the year from data attribute
                const targetYear = button.getAttribute('data-year');

                // Remove active class from all buttons and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Add active class to clicked button
                button.classList.add('active');

                // Show corresponding content
                const targetContent = document.getElementById(`year-${targetYear}`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    }
}); 