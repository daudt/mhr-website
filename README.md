# Mile High Runners Website

A modern, responsive website for Mile High Runners, Erie Colorado's premier running group.

## Features

- Responsive design that works on all devices
- Modern UI with smooth animations
- Newsletter subscription
- Social media integration
- Mobile-friendly navigation
- Event calendar integration
- Subscribable training calendar feed (`/calendar.ics`)
- Contact form

## Setup Instructions

1. Clone this repository
2. Add your images to the `images` directory
3. Update the social media links in `index.html`
4. Customize the content in `index.html` to match your needs
5. Update the contact information in the footer
6. Add your logo if available

## File Structure

```
├── index.html          # Main HTML file
├── styles.css          # CSS styles
├── main.js            # JavaScript functionality
├── images/            # Image directory
│   └── hero-bg.jpg    # Hero background image
└── README.md          # This file
```

## Customization

### Colors
The website uses CSS variables for easy color customization. Edit the `:root` section in `styles.css` to change the color scheme:

```css
:root {
    --primary-color: #2C3E50;
    --secondary-color: #E74C3C;
    --accent-color: #3498DB;
    --text-color: #333;
    --light-gray: #f5f5f5;
    --white: #ffffff;
}
```

### Images
Replace the placeholder images in the `images` directory with your own:
- `hero-bg.jpg`: Main hero section background
- Add any additional images needed for the website

### Content
Update the content in `index.html` to match your specific needs:
- Update navigation links
- Modify feature cards
- Add your own events
- Update contact information
- Add your social media links

## Training Calendar Feed

`calendar.ics` is a subscribable iCalendar feed of upcoming practices, published at
<https://milehighrunners.com/calendar.ics> and linked from the subscribe bar on
`calendar.html`.

It is **generated, not hand-edited**. `data/workouts.json` is the single source of truth for
both the schedule page and the feed, so the two can never disagree. Whenever
`data/workouts.json` changes, the `Update Calendar Feed` workflow
(`.github/workflows/calendar_ics.yml`) runs `scripts/generate_workouts_ics.js` and commits the
regenerated `calendar.ics`.

To regenerate locally:

```bash
node scripts/generate_workouts_ics.js
```

The feed mirrors the current contents of `workouts.json` — current and upcoming practices only.
Past practices are not retained, and subscribers' calendars follow suit.

## Development

To make changes to the website:

1. Edit the HTML in `index.html`
2. Modify styles in `styles.css`
3. Update functionality in `main.js`

## Browser Support

The website is compatible with:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## License

© 2024 Mile High Runners. All rights reserved. 