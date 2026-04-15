/**
 * Contact form validation logic extracted from main.js for testability.
 * main.js uses an identical copy of this logic inline (plain <script>, not a module).
 */

function validateContactForm({ name, email, subject, message }) {
  const errors = [];

  if (!name || name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Please enter your name (at least 2 characters)' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    errors.push({ field: 'email', message: 'Please enter a valid email address' });
  }

  if (!subject || subject.trim().length < 3) {
    errors.push({ field: 'subject', message: 'Please enter a subject (at least 3 characters)' });
  }

  if (!message || message.trim().length < 10) {
    errors.push({ field: 'message', message: 'Please enter a message (at least 10 characters)' });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateContactForm };
