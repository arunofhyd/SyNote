Here is a prompt you can use to implement the logo glow effect in other applications:

---

**Prompt for AI / Developer:**

I want to add a sophisticated "glow on hover" effect to the logo on my login screen, similar to the one used in SyNote.

Please implement the following CSS and HTML updates:

### 1. Add the CSS Class
Add this `.logo-glow` class to your global stylesheet or component styles. It uses a `filter: drop-shadow` effect (instead of box-shadow) to ensure the glow perfectly hugs the logo's shape without creating visible square outlines or artifacts.

```css
/* Logo Glow Effect */
.logo-glow {
    /* Base glow: subtle drop shadow */
    filter: drop-shadow(0 0 15px hsl(var(--primary) / 0.3));
    transition: filter 0.3s ease-in-out;

    /* Ensure no default border, outline, or background interferes */
    border: none !important;
    outline: none !important;
    background-color: transparent !important;
    --tw-ring-color: transparent !important;
}

.logo-glow:hover {
    /* Hover state: intensified and larger glow */
    filter: drop-shadow(0 0 30px hsl(var(--primary) / 0.6));
}
```

### 2. Verify CSS Variables
Ensure your application defines the `--primary` variable as space-separated HSL channels (e.g., `240 5.9% 10%`). This is required for the `hsl(... / alpha)` syntax to work.

*If your app uses Hex codes (e.g., `#000000`) for variables, replace `hsl(var(--primary) / 0.3)` with a static color like `rgba(0, 0, 0, 0.3)` or convert your variables.*

### 3. Update the HTML
Add the `logo-glow` class to your logo `<img>` element.

```html
<img src="/path/to/logo.png" class="logo-glow rounded-full object-cover" alt="Logo">
```
*(Note: `rounded-full` and `object-cover` are recommended).*

---

### Technical Specifications

If you need to manually configure the shadow strength, here are the exact measurements:

| State | Blur Radius | Opacity (Strength) | CSS Syntax |
| :--- | :--- | :--- | :--- |
| **Normal** | **15px** | **30%** (0.3) | `drop-shadow(0 0 15px rgba(..., 0.3))` |
| **Hover** | **30px** | **60%** (0.6) | `drop-shadow(0 0 30px rgba(..., 0.6))` |
