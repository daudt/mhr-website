import { describe, it, expect } from 'vitest';
const { validateContactForm } = require('../lib/validate-contact');

describe('validateContactForm', () => {
  const validData = {
    name: 'John Doe',
    email: 'john@example.com',
    subject: 'Hello there',
    message: 'This is a test message that is long enough.',
  };

  it('passes with valid data', () => {
    const result = validateContactForm(validData);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when name is empty', () => {
    const result = validateContactForm({ ...validData, name: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'name' }),
    );
  });

  it('fails when name is too short', () => {
    const result = validateContactForm({ ...validData, name: 'A' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'name' }),
    );
  });

  it('fails with invalid email', () => {
    const result = validateContactForm({ ...validData, email: 'not-an-email' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'email' }),
    );
  });

  it('fails with missing @ in email', () => {
    const result = validateContactForm({ ...validData, email: 'john.example.com' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'email' }),
    );
  });

  it('fails when subject is too short', () => {
    const result = validateContactForm({ ...validData, subject: 'Hi' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'subject' }),
    );
  });

  it('fails when message is too short', () => {
    const result = validateContactForm({ ...validData, message: 'Short' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'message' }),
    );
  });

  it('collects multiple errors at once', () => {
    const result = validateContactForm({ name: '', email: '', subject: '', message: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(4);
  });
});
