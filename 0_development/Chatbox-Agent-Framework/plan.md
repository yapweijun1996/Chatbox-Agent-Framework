# UI Enhancement Plan

## 1. Overview
This plan focuses on refining the Chatbox Agent Framework UI to achieve a premium, professional aesthetic while maintaining a developer-friendly codebase. The goal is to address recent feedback (e.g., button sizing), ensure design consistency, and leverage modern CSS/Tailwind features.

## 2. Visual Audit & Refinements

### 2.1 Buttons & Controls
- **Target**: `.new-chat-btn` in Sidebar.
- **Issue**: Previously reported as "big and ugly".
- **Plan**:
    - Reduce height from `56px` to `44px` or `48px`.
    - Simplify the gradient to a more subtle solid color with a hover state.
    - Reduce the icon box size.
    - **Status**: TO DO.

- **Target**: `pill-btn` in Top Bar.
- **Plan**: Ensure stroke/border colors are subtle (opacity 0.08 -> 0.12 on hover).

### 2.2 Typography & Spacing
- **Fonts**: Confirm `Inter` for UI text and `JetBrains Mono` for code/logs.
- **Hierarchy**:
    - Sidebar headers: uppercase, tracking `0.04em`, smaller size (`11px`).
    - Chat messages: `15px` or `16px` for readability, line-height `1.5` or `1.6`.

### 2.3 Color System (`theme.css` vs `tailwind.config.js`)
- **CRITICAL ISSUE**: There is a conflict between `demo/styles/theme.css` (which has the new "premium" values) and `tailwind.config.js` (which holds legacy/gray values).
- **Impact**: Classes like `bg-bg-sidebar` in HTML might be pulling the wrong color from the JS config, while CSS files use the CSS variables.
- **Action Items**:
    - Migrate fully to Tailwind v4 CSS-first configuration.
    - Deprecate `tailwind.config.js` color definitions in favor of `theme.css` variables.
    - Ensure all Tailwind classes resolve to the CSS variables (e.g., color `bg-sidebar` should map to `var(--color-bg-sidebar)`).

### 2.4 Layout & Shell
- **App Shell**: The background `.drift` animation (`base.css`) is nice. Ensure it doesn't cause high CPU usage (will check `will-change`).
- **Sidebar**:
    - Verify glassmorphism (`backdrop-filter`) works across browsers.
    - Mobile transition: Ensure the slide-in doesn't jitter.

## 3. Implementation Steps

### Step 1: Theme & Variables
- Update `demo/styles/theme.css` to use a consistent HSL-based color system.
- Add utility vars for common shadows and blurs.

### Step 2: Component Refactoring
- **Sidebar**:
    - Refine `.new-chat-btn`: Make it sleeker.
    - Adjust `.sidebar-header` spacing.
- **Top Bar**:
    - [x] Adjust `.model-chip` and controls to align perfectly (Implemented absolute centering & refined styling).

### Step 3: Tailwind Integration
- Clean up `demo/index.html` classes.
- Move reusable utility classes (like `glass-panel`) to `@layer components` in `utilities.css` or `base.css` if we want to use Tailwind fully.

### Step 4: Polish
- Add "Empty State" illustrations or icons for the chat area.
- Enhance the "Welcome" screen with better cards.

## 4. Next Actions
- [ ] Review this plan.
- [ ] Approve refinement of `.new-chat-btn`.
- [ ] Approve color palette tweaks.
