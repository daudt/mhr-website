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

    // Newsletter form submission
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = newsletterForm.querySelector('input[type="email"]').value;
            
            // Here you would typically send this to your backend
            console.log('Newsletter signup:', email);
            
            // Show success message
            const successMessage = document.createElement('p');
            successMessage.textContent = 'Thank you for subscribing!';
            successMessage.style.color = '#2ecc71';
            newsletterForm.appendChild(successMessage);
            
            // Clear the form
            newsletterForm.reset();
            
            // Remove success message after 3 seconds
            setTimeout(() => {
                successMessage.remove();
            }, 3000);
        });
    }

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

    // Slideshow functionality
    const slideshow = document.querySelector('.slideshow');
    if (slideshow) {
        const slides = slideshow.querySelectorAll('.slide');
        const indicators = document.querySelectorAll('.slideshow-indicators .indicator');
        const prevBtn = document.querySelector('.prev-btn');
        const nextBtn = document.querySelector('.next-btn');
        const playPauseBtn = document.querySelector('.slideshow-play-pause');
        const playPauseIcon = playPauseBtn?.querySelector('i');

        console.log('Slideshow initialized:', {
            slidesCount: slides.length,
            indicatorsCount: indicators.length,
            prevBtn: !!prevBtn,
            nextBtn: !!nextBtn,
            playPauseBtn: !!playPauseBtn
        });

        let currentSlide = 0;
        let isPlaying = true;
        let slideshowInterval;
        let isHovering = false;

        function showSlide(index) {
            // Remove active class from all slides and indicators
            slides.forEach(slide => slide.classList.remove('active'));
            indicators.forEach(indicator => indicator.classList.remove('active'));

            // Add active class to current slide and indicator
            if (slides[index]) {
                slides[index].classList.add('active');
            }
            if (indicators[index]) {
                indicators[index].classList.add('active');
            }
            
            currentSlide = index;
        }

        function nextSlide() {
            const nextIndex = (currentSlide + 1) % slides.length;
            showSlide(nextIndex);
        }

        function prevSlide() {
            const prevIndex = (currentSlide - 1 + slides.length) % slides.length;
            showSlide(prevIndex);
        }

        function startSlideshow() {
            if (slideshowInterval) return;
            slideshowInterval = setInterval(nextSlide, 4000); // Change slide every 4 seconds
            isPlaying = true;
            if (playPauseIcon) {
                playPauseIcon.classList.remove('fa-play');
                playPauseIcon.classList.add('fa-pause');
            }
        }

        function stopSlideshow() {
            clearInterval(slideshowInterval);
            slideshowInterval = null;
            isPlaying = false;
            if (playPauseIcon) {
                playPauseIcon.classList.remove('fa-pause');
                playPauseIcon.classList.add('fa-play');
            }
        }

        function toggleSlideshow() {
            if (isPlaying) {
                stopSlideshow();
            } else {
                startSlideshow();
            }
        }

        // Event listeners
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                nextSlide();
                if (isPlaying) {
                    stopSlideshow();
                    startSlideshow();
                }
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                prevSlide();
                if (isPlaying) {
                    stopSlideshow();
                    startSlideshow();
                }
            });
        }

        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', toggleSlideshow);
        }

        // Indicator clicks
        indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showSlide(index);
                if (isPlaying) {
                    stopSlideshow();
                    startSlideshow();
                }
            });
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            // Only handle keyboard navigation if slideshow is visible and user isn't typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prevSlide();
                if (isPlaying) {
                    stopSlideshow();
                    startSlideshow();
                }
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                nextSlide();
                if (isPlaying) {
                    stopSlideshow();
                    startSlideshow();
                }
            } else if (e.key === ' ' && isHovering) {
                e.preventDefault();
                toggleSlideshow();
            }
        });

        // Initialize first slide
        showSlide(0);
        
        // Start slideshow on page load
        startSlideshow();

        // Pause slideshow when user hovers over it
        slideshow.addEventListener('mouseenter', () => {
            isHovering = true;
            stopSlideshow();
        });
        slideshow.addEventListener('mouseleave', () => {
            isHovering = false;
            if (isPlaying) {
                startSlideshow();
            }
        });
    }

    // Contact Form Handling
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        // Replace with your Formspree endpoint or EmailJS configuration
        // For Formspree: use action="https://formspree.io/f/YOUR_FORM_ID"
        // For EmailJS: configure EmailJS service
        const FORM_ENDPOINT = ''; // Set your form submission endpoint here
        
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
                showFieldError('captchaError', 'CAPTCHA not loaded. Please refresh the page or configure your reCAPTCHA site key.');
                return;
            }
            
            const captchaResponse = grecaptcha.getResponse();
            if (!captchaResponse) {
                showFieldError('captchaError', 'Please complete the CAPTCHA verification');
                return;
            }
            
            // Get form data
            const formData = new FormData(contactForm);
            formData.append('g-recaptcha-response', captchaResponse);
            
            // Show loading state
            setFormLoading(true);
            
            try {
                // If FORM_ENDPOINT is set, use it
                if (FORM_ENDPOINT) {
                    const response = await fetch(FORM_ENDPOINT, {
                        method: 'POST',
                        body: formData,
                        headers: {
                            'Accept': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        showFormMessage('success', 'Thank you! Your message has been sent successfully.');
                        contactForm.reset();
                        if (typeof grecaptcha !== 'undefined') {
                            grecaptcha.reset();
                        }
                    } else {
                        throw new Error('Form submission failed');
                    }
                } else {
                    // Demo mode - show success message
                    // Replace this with your actual form submission service
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
                    showFormMessage('success', 'Thank you! Your message has been sent successfully. (Note: Please configure FORM_ENDPOINT in main.js to enable actual form submission)');
                    contactForm.reset();
                    if (typeof grecaptcha !== 'undefined') {
                        grecaptcha.reset();
                    }
                }
            } catch (error) {
                console.error('Form submission error:', error);
                showFormMessage('error', 'Sorry, there was an error sending your message. Please try again later or call us directly.');
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