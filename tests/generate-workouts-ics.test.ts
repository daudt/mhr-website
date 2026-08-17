import { describe, it, expect } from 'vitest';
const ical = require('node-ical');
const {
    escapeText,
    foldLine,
    parseTime12h,
    eventUid,
    buildCalendar,
    hasMeaningfulChange,
} = require('../scripts/generate_workouts_ics');

const NOW = new Date('2026-08-17T12:00:00Z');

const WORKOUT = {
    date: '2026-08-18',
    time: '5:00 AM',
    location: {
        name: 'Erie Middle School',
        address: '650 Main Street, Erie, CO 80516',
        map_link: 'https://maps.google.com/?q=Erie+Middle+School',
    },
    description: 'Warmup; 4 x 400 meters at 5k pace, then cooldown',
};

const SATURDAY = {
    date: '2026-08-22',
    time: '6:30 AM',
    location: { name: 'Fox Dog Coffee Shop' },
    description: 'Long run',
};

function parse(ics: string) {
    return Object.values(ical.parseICS(ics)).filter((e: any) => e.type === 'VEVENT') as any[];
}

describe('escapeText', () => {
    it('escapes the RFC 5545 special characters', () => {
        expect(escapeText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d');
    });

    it('escapes newlines', () => {
        expect(escapeText('line one\nline two')).toBe('line one\\nline two');
        expect(escapeText('line one\r\nline two')).toBe('line one\\nline two');
    });

    it('handles null and undefined', () => {
        expect(escapeText(null)).toBe('');
        expect(escapeText(undefined)).toBe('');
    });
});

describe('foldLine', () => {
    it('leaves short lines alone', () => {
        expect(foldLine('SUMMARY:Short')).toBe('SUMMARY:Short');
    });

    it('folds long lines to 75 octets with a leading space', () => {
        const folded = foldLine('DESCRIPTION:' + 'x'.repeat(200));
        const segments = folded.split('\r\n');
        expect(segments.length).toBeGreaterThan(1);
        expect(segments[0].length).toBe(75);
        segments.slice(1).forEach((s) => expect(s.startsWith(' ')).toBe(true));
    });

    it('counts octets, not characters, and never splits a UTF-8 sequence', () => {
        // En-dashes are 3 bytes each and appear in real workout descriptions.
        const folded = foldLine('DESCRIPTION:' + '—'.repeat(60));
        folded.split('\r\n').forEach((segment) => {
            expect(Buffer.byteLength(segment, 'utf8')).toBeLessThanOrEqual(75);
            expect(segment).not.toContain('\ufffd');
        });
        expect(folded.replace(/\r\n /g, '')).toBe('DESCRIPTION:' + '—'.repeat(60));
    });
});

describe('parseTime12h', () => {
    it('parses AM and PM times', () => {
        expect(parseTime12h('5:00 AM')).toEqual({ hour: 5, minute: 0 });
        expect(parseTime12h('6:30 PM')).toEqual({ hour: 18, minute: 30 });
    });

    it('handles midnight and noon', () => {
        expect(parseTime12h('12:00 AM')).toEqual({ hour: 0, minute: 0 });
        expect(parseTime12h('12:15 PM')).toEqual({ hour: 12, minute: 15 });
    });

    it('tolerates lowercase and stray whitespace', () => {
        expect(parseTime12h('  7:05 am ')).toEqual({ hour: 7, minute: 5 });
    });

    it('returns null for unparseable input', () => {
        ['', 'noon', '25:00 AM', '5:99 AM', '5:00', null, undefined].forEach((v) => {
            expect(parseTime12h(v)).toBeNull();
        });
    });
});

describe('eventUid', () => {
    it('is stable across runs for the same event', () => {
        expect(eventUid(WORKOUT)).toBe(eventUid({ ...WORKOUT }));
    });

    it('ignores description and address changes so updates apply in place', () => {
        const edited = {
            ...WORKOUT,
            description: 'Completely rewritten workout text',
            location: { ...WORKOUT.location, address: 'Corrected address' },
        };
        expect(eventUid(edited)).toBe(eventUid(WORKOUT));
    });

    it('differs when the time differs on the same date', () => {
        expect(eventUid({ ...WORKOUT, time: '5:20 AM' })).not.toBe(eventUid(WORKOUT));
    });

    it('differs when the venue differs', () => {
        expect(eventUid({ ...WORKOUT, location: { name: 'Thomas Reservoir' } })).not.toBe(eventUid(WORKOUT));
    });

    it('is a hex sha1 at the MHR domain', () => {
        expect(eventUid(WORKOUT)).toMatch(/^[0-9a-f]{40}@milehighrunners\.com$/);
    });
});

describe('buildCalendar', () => {
    it('produces a feed a real iCalendar parser accepts', () => {
        const { ics } = buildCalendar([WORKOUT, SATURDAY], NOW);
        const events = parse(ics);
        expect(events).toHaveLength(2);
        expect(events.map((e) => e.summary)).toEqual([
            'MHR Practice — Erie Middle School',
            'MHR Practice — Fox Dog Coffee Shop',
        ]);
    });

    it('emits the calendar-level subscription metadata', () => {
        const { ics } = buildCalendar([WORKOUT], NOW);
        expect(ics).toContain('X-WR-CALNAME:Mile High Runners Training');
        expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT4H');
        expect(ics).toContain('X-PUBLISHED-TTL:PT4H');
        expect(ics).toContain('SOURCE;VALUE=URI:https://milehighrunners.com/calendar.ics');
        expect(ics).toContain('METHOD:PUBLISH');
    });

    it('includes a VTIMEZONE for America/Denver and uses TZID datetimes', () => {
        const { ics } = buildCalendar([WORKOUT], NOW);
        expect(ics).toContain('BEGIN:VTIMEZONE');
        expect(ics).toContain('TZID:America/Denver');
        expect(ics).toContain('DTSTART;TZID=America/Denver:20260818T050000');
        expect(ics).not.toMatch(/DTSTART:\d{8}T\d{6}Z/);
    });

    it('resolves local times correctly through DST', () => {
        const summer = parse(buildCalendar([WORKOUT], NOW).ics)[0];
        // 5:00 AM MDT (UTC-6)
        expect(summer.start.toISOString()).toBe('2026-08-18T11:00:00.000Z');

        const winter = parse(buildCalendar([{ ...WORKOUT, date: '2026-12-15' }], NOW).ics)[0];
        // 5:00 AM MST (UTC-7)
        expect(winter.start.toISOString()).toBe('2026-12-15T12:00:00.000Z');
    });

    it('keeps both same-day pace groups as distinct events', () => {
        const { ics } = buildCalendar([WORKOUT, { ...WORKOUT, time: '5:20 AM' }], NOW);
        const events = parse(ics);
        expect(events).toHaveLength(2);
        expect(new Set(events.map((e) => e.uid)).size).toBe(2);
    });

    it('sorts by date then start time', () => {
        const { ics } = buildCalendar([SATURDAY, { ...WORKOUT, time: '5:20 AM' }, WORKOUT], NOW);
        const starts = parse(ics).map((e) => e.start.toISOString());
        expect(starts).toEqual([...starts].sort());
    });

    it('gives weekday practices 60 minutes and Saturdays 90', () => {
        const [weekday, saturday] = parse(buildCalendar([WORKOUT, SATURDAY], NOW).ics);
        expect((weekday.end - weekday.start) / 60000).toBe(60);
        expect((saturday.end - saturday.start) / 60000).toBe(90);
    });

    it('marks cancelled practices with STATUS:CANCELLED and the reason', () => {
        const { ics } = buildCalendar(
            [{ ...WORKOUT, cancelled: true, cancellation_reason: 'Lightning' }],
            NOW
        );
        const [event] = parse(ics);
        expect(event.status).toBe('CANCELLED');
        expect(event.summary).toBe('CANCELLED — MHR Practice — Erie Middle School');
        expect(event.description).toContain('Lightning');
    });

    it('keeps a cancelled practice in the feed rather than dropping it', () => {
        const { ics } = buildCalendar([{ ...WORKOUT, cancelled: true }, SATURDAY], NOW);
        expect(parse(ics)).toHaveLength(2);
    });

    it('falls back to generic wording when no cancellation reason is given', () => {
        const { ics } = buildCalendar([{ ...WORKOUT, cancelled: true }], NOW);
        expect(parse(ics)[0].description).toContain('cancelled');
    });

    it('attaches a 45-minute alarm to active practices only', () => {
        expect(buildCalendar([WORKOUT], NOW).ics).toContain('TRIGGER:-PT45M');
        expect(buildCalendar([{ ...WORKOUT, cancelled: true }], NOW).ics).not.toContain('BEGIN:VALARM');
    });

    it('round-trips special characters through escaping', () => {
        const tricky = {
            ...WORKOUT,
            description: 'Repeats: 4 x 400m, 800m; then C:\\drills\nCooldown',
        };
        const [event] = parse(buildCalendar([tricky], NOW).ics);
        expect(event.description).toContain('4 x 400m, 800m; then C:\\drills');
        expect(event.description).toContain('\nCooldown');
    });

    it('carries location and map link through', () => {
        const [event] = parse(buildCalendar([WORKOUT], NOW).ics);
        expect(event.location).toBe('Erie Middle School, 650 Main Street, Erie, CO 80516');
        expect(event.url.val).toContain('maps.google.com');
    });

    it('skips unparseable events instead of emitting a broken feed', () => {
        const { ics, included, skipped } = buildCalendar(
            [WORKOUT, { date: 'next Tuesday', time: 'dawn', description: 'Mystery' }],
            NOW
        );
        expect(included).toBe(1);
        expect(skipped).toHaveLength(1);
        expect(parse(ics)).toHaveLength(1);
    });

    it('produces a valid empty calendar when there are no workouts', () => {
        const { ics, included } = buildCalendar([], NOW);
        expect(included).toBe(0);
        expect(ics).toContain('BEGIN:VCALENDAR');
        expect(ics).toContain('END:VCALENDAR');
        expect(parse(ics)).toHaveLength(0);
    });

    it('uses CRLF line endings and folds every line to 75 octets', () => {
        const { ics } = buildCalendar([WORKOUT, SATURDAY], NOW);
        expect(ics.split('\n').length).toBe(ics.split('\r\n').length);
        ics.split('\r\n').forEach((line: string) => {
            expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
        });
    });

    it('is deterministic for a fixed timestamp', () => {
        expect(buildCalendar([WORKOUT, SATURDAY], NOW).ics).toBe(
            buildCalendar([WORKOUT, SATURDAY], NOW).ics
        );
    });
});

describe('hasMeaningfulChange', () => {
    it('ignores a DTSTAMP-only difference so the workflow makes no empty commits', () => {
        const a = buildCalendar([WORKOUT], new Date('2026-08-17T12:00:00Z')).ics;
        const b = buildCalendar([WORKOUT], new Date('2026-08-18T09:30:00Z')).ics;
        expect(a).not.toBe(b);
        expect(hasMeaningfulChange(a, b)).toBe(false);
    });

    it('detects a real content change', () => {
        const a = buildCalendar([WORKOUT], NOW).ics;
        const b = buildCalendar([{ ...WORKOUT, description: 'New workout' }], NOW).ics;
        expect(hasMeaningfulChange(a, b)).toBe(true);
    });

    it('treats a missing previous feed as a change', () => {
        expect(hasMeaningfulChange('', buildCalendar([WORKOUT], NOW).ics)).toBe(true);
    });
});

describe('the committed calendar.ics', () => {
    it('matches what the generator produces from the committed workouts.json', () => {
        const workouts = require('../data/workouts.json');
        const committed = require('fs').readFileSync(require('path').join(__dirname, '../calendar.ics'), 'utf8');
        const { ics } = buildCalendar(workouts, NOW);
        expect(hasMeaningfulChange(committed, ics)).toBe(false);
    });

    it('parses and contains every workout', () => {
        const workouts = require('../data/workouts.json');
        const committed = require('fs').readFileSync(require('path').join(__dirname, '../calendar.ics'), 'utf8');
        expect(parse(committed)).toHaveLength(workouts.length);
    });
});
