# Product Specification: Corneal Astigmatism Optics Visualizer

## 0. Current Status & Handoff (updated 2026-10-13) — read this first

**Purpose:** a patient-education tool that shows corneal astigmatism, and now also myopia/hyperopia (axial length), near vision and accommodation, and cataracts. It is a single rotatable Three.js 3D eye, not the three-viewport app described in Sections 2, 4 and 5. Those sections are superseded by Section 8, which holds the authoritative details of the current model. Section 7 decisions still apply where noted.

### What exists now
* **`index.html`:** top bar with camera presets (45° / Front / Side / Top). The left sidebar has three groups of controls.
  * **Cornea:**
    * Curvature 1 and Curvature 2 sliders (38–50 D, default 43.5 D) with green retina-focus ticks;
    * a "Lock curvatures together" checkbox;
    * a "Reset both to retina focus" button;
    * the Axis slider and the "Exaggerate curvature (×5)" checkbox.
  * **Eye:**
    * an Axial length slider (20–30 mm, default 24);
    * a Light vergence slider (0–10 D, default 0 = distant);
    * an Accommodation checkbox (off by default).
  * **Show:** four toggles in a 2×2 grid, with sub-controls that show only while their toggle is on:
    * **Light rays**, with checkboxes underneath for **Astigmatism** (on) and **Cataracts** (off). Either, both or neither can be ticked;
    * **Curvature lines**;
    * **Iris / pupil**, with a Pupil slider (2–8 mm);
    * **Lens**, with a Cataract slider (7 stages).
  * **Readouts:** cylinder; WTR/ATR/Oblique type; each curvature's power @ meridian; Accommodation (Off / "x of 7.00 D" / "7.00 D (at its limit)").
* **`js/eyeModel.js`:** all geometry and optics. Exports `build, updateCornea, setVisibility, setPupil, setCataract, orderForCamera, retinaFocusPower, DIM, COLORS, CATARACT_STAGES`.
* **`js/app.js`:** scene, lights, OrbitControls, camera presets, and all UI wiring. It calls `EyeModel.orderForCamera(eye, camera)` every frame before rendering.
* **`css/styles.css`:** dark UI.

### Change history
**Committed and pushed in `5a8471e` (2026-10-11 evening):**
1. Default curvatures 43.5 D.
2. Iris / pupil and Lens toggles.
3. Iris diameter equal to the cornea's.
4. The curvature lock.
5. Cornea, sclera and iris thinned to 0.25 mm. The posterior cornea follows the anterior surface.
6. The Pupil slider.
7. The Cataract slider (6 stages at the time).

**Made 2026-10-12/13 (uncommitted until you push; see Next steps):**
1. **Lens highlight fades with cataract stage:** a new `shine` column in `CATARACT_STAGES`, which sets the lens's specular strength.
2. **Opaque cataract seen from behind:** the lens and cornea draw order is now chosen per frame by `orderForCamera` (whichever is nearer the camera draws last), so the cornea no longer shows through a dense cataract.
3. **Leukocoria** added as the 7th cataract stage: a white, opaque lens.
4. **Fixed focus reference:** focal points are measured from the fixed reference apex (`L.refApexY`), not the moving apex. Moving one curvature no longer shifts the other meridian's focus. The retina-focus power is therefore independent of the other slider.
5. **"Reset both to retina focus" button:** snaps both curvatures to the retina-focus power for the current axial length and exaggeration. It also updates the lock's stored values.
6. **Axial length slider:** only the globe behind its centre stretches (`buildGlobe`, `stretchProfile`). The front of the eye never moves. Rays hit the stretched retina, and the ticks and the Reset button follow the axial length.
7. **Light rays sub-menu**, as checkboxes:
   * **Astigmatism:** the original two-meridian rays.
   * **Cataracts:** 95 rays in evenly spaced rings over the cornea, out to 5 mm. The iris blocks rays outside the pupil. Rays scatter leaving the lens, with deterministic per-ray directions. The scatter is zero at the lens centre, rising with the square of the radius to full at 2.2 mm out. Rays fade beyond the lens by stage, and the last two stages block them at the lens front. A hidden lens counts as clear.
8. **Light vergence and accommodation:**
   * Near (divergent) light pushes the focus back.
   * Accommodation adds lens power to bring the mean meridian focus back onto the retina, capped at 7 D. Vergence of 7–10 D therefore shows the focus slipping even with accommodation on.
   * The lens visibly rounds up as it accommodates (`lensShape(t)`; front apex fixed).

### Next steps / open ideas (confirm with the user before building)
* **Commit and push the 2026-10-12/13 work first** (`git status` shows it as modified). Then run `git pull` on the other laptop.
* In **Astigmatism** ray mode, the iris doesn't block rays at small pupils (Cataracts mode does). Consider adding the same blocking, or scaling the ray height to the pupil.
* **Readouts that might help patients:** where the focus is relative to the retina ("1.8 mm in front: myopic"); refractive error from axial length; a near-point distance.
* **Vergence and exaggeration:** vergence and accommodation are *not* exaggerated, so 1 D of vergence moves the focus about as much as 0.2 D on a curvature slider while ×5 is on. Revisit if this confuses anyone.
* **Accommodation readout:** it is in drawn diopters. When the cornea itself is off-focus with exaggeration on, it can overstate the true accommodation (×5 on the corneal part).
* **Retina in the cut-away half:** scattered cataract rays that head into the cut-away half end on the invisible retina there, just outside the visible eye outline in the 45° view.
* **Iris gap:** there's a small gap between the iris root and the sclera (iris diameter = cornea's). It can be closed if wanted.
* **Earlier ideas, still open:**
  * rays for oblique meridians in Astigmatism mode;
  * a visible Sturm's interval / circle of least confusion;
  * a camera preset that shows both meridian profiles;
  * on-screen labels;
  * a patient mode that hides the clinical readouts.
* **Known limitations:**
  * rays are paraxial (aimed at the focal point);
  * focal depth uses the teaching depth scale (§7.1);
  * focus dots draw on top (`depthTest: false`) and are omitted beyond `maxFocusDistance` (60 mm);
  * the divergence of near light is drawn compressed (`vergenceSourceScale`);
  * sliders step in 0.25 D, so a tick can't always be hit exactly.
* **Spec items not yet ported:** ray density control, selected cross-section plane, Placido rings.

### Environment & commands
* **No build step, no package manager.** Open `index.html` directly in a browser (double-click or `start index.html`). An internet connection is required because Three.js r128 and OrbitControls load from CDNs. **After pulling changes, hard-reload (Ctrl+F5)**, or the browser may run cached scripts.
* **Git:** remote `origin` = `https://github.com/toepug/test-project.git`, branch `main`. Commit and push to sync:
  ```
  git add -A
  git commit -m "Axial length, vergence/accommodation, cataract rays, lens fixes"
  git push origin main
  ```
  On the other laptop: `git pull`.
* **Two machines:**
  * Laptop A has the project at `C:\dev\test-project` and no Node.js or Python.
  * Laptop B has it at `C:\Users\jason\dev\test-project`, with Python 3.13 (no Pillow) and no Node.js.
  * Neither machine has Edge on PATH. It is at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.
* **Visual checks (headless Edge screenshots):**
  1. Copy `index.html` to a scratch folder with `<base href="file:///<project path>/">` inserted after `<head>`.
  2. Optionally add a `<script>` before `</body>` that drives the UI:
     * sliders: set `.value`, then `dispatchEvent(new Event('input'))`;
     * buttons and checkboxes: `.click()`, for example `document.querySelector('[data-view=side]').click()` or `document.querySelector('[data-ray-mode=cataract]').click()`.
  3. Run:
     ```
     "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --window-size=1300,900 --virtual-time-budget=6000 --user-data-dir=<scratch>\edge-profile --screenshot=<scratch>\shot.png --enable-logging=stderr --v=0 file:///<scratch>/page.html 2> <scratch>\log.txt
     ```
  4. Search the log for `Uncaught` or `THREE.` warnings, and use `console.log(...)` in the injected script to read values back. The "Tracking Prevention blocked access to storage" lines are harmless.
  * **No rear camera preset:** for a view from behind, copy `js/app.js` to scratch, add a `back` entry to `VIEWS` and `setView('back')`, and point the page's `<script src>` at the copy. Use the same trick (a scratch copy of `eyeModel.js` with an extra `console.log`) to debug model values.
* **Editing tip:** multi-line `python - <<'EOF'` heredocs sometimes fail to parse in this Bash tool. Writing the script to a scratch `.py` file and running it with `python -I` is reliable.
* **Colour gotcha:** the renderer outputs sRGB (r128). Wrap hex colours that must display exactly in `new THREE.Color(hex).convertSRGBToLinear()`.

## 1. System Prompt & High-Level Directives

```
You are building an interactive HTML5/JavaScript application that visualizes corneal astigmatism using Canvas 2D and Three.js (WebGL). 

CORE OPTICAL MODELS:
- Model ONLY corneal astigmatism (toric anterior corneal surface).
- Strictly EXCLUDE the crystalline lens and lenticular astigmatism from all visual models and optical calculations.
- Parallel incoming light rays pass through the air-cornea interface (n1 = 1.000, n2 = 1.376) into the aqueous humor directly onto the retina (d ≈ 24 mm).

```

## 2. Tech Stack & File Structure

```
/
├── index.html
├── css/
│   └── styles.css
└── js/
    ├── app.js             // Main state coordinator & UI controller
    ├── optics.js          // Ray-tracing equations & principal meridian math
    ├── canvas2d.js        // Cross-section & Front-eye 2D renderers
    └── viewer3d.js        // Three.js 45-degree isometric 3D view

```

* **Dependencies (CDN Links in `index.html`):**

  * Three.js (`https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`)

  * OrbitControls (`https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js`)

## 3. Optical Mathematical Model (`js/optics.js`)

Implement real-time optical calculations based on Snell's Law and toric geometry:

1. **Toric Cornea Definition:**

   * Steep Radius ($R_{\text{steep}}$): derive from Steep Power ($P_{\text{steep}}$) using $R = \frac{n_2 - n_1}{P} = \frac{0.376}{P}$.

   * Flat Radius ($R_{\text{flat}}$): derive from Flat Power ($P_{\text{flat}}$) using $R = \frac{0.376}{P}$.

   * Astigmatic Axis ($\theta_{\text{axis}}$): $[0^\circ, 180^\circ]$.

2. **Principal Meridians:**
   

   $$
   \text{Meridian}_{\text{flat}} = \theta_{\text{axis}}
   $$

   $$
   \text{Meridian}_{\text{steep}} = (\theta_{\text{axis}} + 90^\circ) \bmod 180^\circ
   $$

3. **Refractive Focal Distances:**
   

   $$
   f_{\text{steep}} = \frac{n_2 \cdot R_{\text{steep}}}{n_2 - n_1} = \frac{1.376 \cdot R_{\text{steep}}}{0.376}
   $$

   $$
   f_{\text{flat}} = \frac{n_2 \cdot R_{\text{flat}}}{n_2 - n_1} = \frac{1.376 \cdot R_{\text{flat}}}{0.376}
   $$

4. **Sturm’s Interval & Circle of Least Confusion (CLC):**

   * Focal Point 1 ($F_1$): $\min(f_{\text{steep}}, f_{\text{flat}})$

   * Focal Point 2 ($F_2$): $\max(f_{\text{steep}}, f_{\text{flat}})$

   * Interval length: $\Delta f = \vert{}F_2 - F_1\vert{}$

   * Position of CLC: $f_{\text{CLC}} = \frac{2 \cdot f_{\text{steep}} \cdot f_{\text{flat}}}{f_{\text{steep}} + f_{\text{flat}}}$

## 4. User Interface & Control Panel (`js/app.js`)

Design a split-screen layout: **Control Sidebar** on the left (300px) and a **Viewports Grid** on the right.

### Control Inputs

| Input Control | ID | Range / Type | Default | Description | 
| ----- | ----- | ----- | ----- | ----- | 
| **Flat Power** | `#input-flat-power` | Slider ($38.00 - 50.00\text{ D}$, step $0.25$) | $42.00\text{ D}$ | Flatter corneal meridian power | 
| **Steep Power** | `#input-steep-power` | Slider ($38.00 - 50.00\text{ D}$, step $0.25$) | $45.00\text{ D}$ | Steepest corneal meridian power | 
| **Cylinder Axis** | `#input-axis` | Slider ($0^\circ - 180^\circ$, step $1^\circ$) | $90^\circ$ | Orientation of the flat meridian | 
| **Eye Length** | `#input-axial-length` | Slider ($20.00 - 28.00\text{ mm}$, step $0.1$) | $24.00\text{ mm}$ | Anterior-posterior length to retina | 
| **Ray Density** | `#input-ray-count` | Select ($8, 16, 32$ rays) | $16\text{ rays}$ | Number of incoming parallel rays | 
| **Selected Plane** | `#select-plane-angle` | Slider ($0^\circ - 180^\circ$, step $5^\circ$) | $90^\circ$ | Cross-section slice plane | 

### Readout Panel

Display real-time numerical values:

* **Cylindrical Refraction:** e.g., `-3.00 D @ 90°`

* **Astigmatism Type:** Regular (With-the-Rule / Against-the-Rule / Oblique) based on axis location.

* **Focal Interval:** Sturm's Interval ($\Delta f\text{ in mm}$).

## 5. Three Viewport Implementations

```
+-----------------------------------------------------------------------+
|                            TOP HEADER BAR                             |
+-------------------+-------------------------------+-------------------+
| CONTROLS          | VIEW 1: FRONT EYE VIEW (2D)   | VIEW 2: 45° VIEW  |
| - Flat Power      | - Placido Rings Reflection    | - Three.js WebGL  |
| - Steep Power     | - Principal Meridians Overlay | - Toric Surface   |
| - Axis Slider     |                               | - 3D Beam Volume  |
| - Axial Length    +-------------------------------+-------------------+
| - Cross Section   | VIEW 3: CROSS-SECTION RAY DIAGRAM (2D)            |
|                   | - Interactive Cornea-to-Retina Schematic              |
| READOUTS          | - Sturm's Interval & Focal Planes Overlays        |
+-------------------+---------------------------------------------------+

```

### View 1: Front Eye View (`js/canvas2d.js` -> `drawFrontView`)

* **Visuals:** 2D canvas showing an anterior eye view.

* **Placido Rings Simulation:** Draw concentric circles deformed by corneal curvature (oval along the steep axis).

* **Meridian Axes:**

  * Red dashed line representing the **Steep Meridian** ($\theta_{\text{axis}} + 90^\circ$).

  * Blue dashed line representing the **Flat Meridian** ($\theta_{\text{axis}}$).

* **Interactive Cut Indicator:** Highlight the currently selected cross-section angle ($\theta_{\text{selected}}$) with a semi-transparent yellow line.

### View 2: $45^\circ$ View (`js/viewer3d.js`)

* **Engine:** Three.js container rendering at an isometric $45^\circ$ angle with user orbit controls enabled.

* **Geometry Setup:**

  1. **Corneal Mesh:** Parametric surface representing a toric cap $z(x, y) = \frac{x'^2}{2R_{\text{flat}}} + \frac{y'^2}{2R_{\text{steep}}}$, where $(x', y')$ are rotated by $\theta_{\text{axis}}$.

  2. **Light Beam Rays:** Generate a cylindrical bundle of parallel $3\text{D}$ lines (`THREE.LineSegments`) entering the cornea.

  3. **Refracted Focus Envelope:** Refract rays according to toric surface normals, forming the classic $3\text{D}$ Sturm's focal envelope (conoid of Sturm) converging into two line foci perpendicular to each other.

  4. **Retinal Plane:** Semi-transparent circular mesh placed at the configured axial length.

### View 3: Eye Cross-Section Ray Diagram (`js/canvas2d.js` -> `drawCrossSection`)

* **Schematic Anatomy:**

  * Draw 2D schematic outline: Cornea curve $\rightarrow$ Sclera outline $\rightarrow$ Retina wall.

  * Exclude lens structure completely; show empty aqueous space between cornea and retina.

* **Ray Tracing at Selected Meridian (**$\theta_{\text{selected}}$**):**

  * Calculate effective refractive power $P_{\text{eff}}(\theta)$ for the slice plane angle:
    

    $$
    P_{\text{eff}}(\theta) = P_{\text{flat}} \cdot \cos^2(\theta - \theta_{\text{axis}}) + P_{\text{steep}} \cdot \sin^2(\theta - \theta_{\text{axis}})
    $$

  * Trace parallel incoming rays from $z = 0$ to corneal curve.

  * Refract rays at cornea surface to converge at focal distance $f_{\text{eff}} = \frac{1.376 \cdot 0.376}{P_{\text{eff}}}$.

* **Annotation Overlays:**

  * **Focal Line Position 1 (**$F_{\text{steep}}$**)** (Vertical line marker in blue).

  * **Focal Line Position 2 (**$F_{\text{flat}}$**)** (Vertical line marker in red).

  * **Circle of Least Confusion (CLC)** (Dotted vertical line in amber).

  * **Retinal Plane** (Solid red curve or vertical line at configured axial length).

## 6. Functional Acceptance Criteria for Claude Code

1. **Strict Optical Exclusion:** Confirm no lens geometry or lenticular refraction logic exists in `js/optics.js` or any visual canvas.

2. **Real-time Synchronization:** Moving the Axis or Power sliders must seamlessly update all three viewports simultaneously ($60\text{ fps}$ performance target via `requestAnimationFrame`).

3. **Educational Visual Fidelity:**

   * Setting **Flat Power = Steep Power** (e.g., $42\text{ D} / 42\text{ D}$) must make the Sturm's interval collapse into a single point focus (spherical optic/emmetropia or simple myopia/hyperopia).

   * Rotating the **Axis slider** must rotate the 3D focal lines in the Three.js viewport and the Placido oval orientation in the Front View.

4. **Responsive Layout:** Ensure canvas containers automatically recalculate aspect ratios and redraw on browser window resize events.

## 7. Design Decisions (agreed 2026-10-10)

These override any conflicting wording above.

1. **Teaching depth scale.** A cornea-only eye focuses ~30–33 mm behind the apex, beyond any 20–28 mm retina. All drawings therefore scale distances behind the cornea by `DEPTH_SCALE = 24 / f(43.5 D) ≈ 0.759`, so the 38–50 D focal range lands on the 20–28 mm eye-length range. Readouts show the true (unscaled) values, and every viewport shows a "depth not to scale" label.
2. **Focal distance formula.** Use `f = n2 / P` (i.e. `1.376 / P` m, consistent with Section 3) everywhere, including the cross-section `f_eff`. The `1.376 · 0.376 / P` form in Section 5 is a typo.
3. **No flat/steep labelling (revised 2026-10-11).** The sliders are **Curvature 1** (`#input-curvature-1`, on `#input-axis`) and **Curvature 2** (`#input-curvature-2`, at axis + 90°). They are never swapped or relabelled, whichever value is higher. Readouts still derive the minus cylinder and its axis (meridian of the lower power).
4. **Colours, everywhere:** Curvature 1 = blue, Curvature 2 = red, CLC = amber, retina = green, selected plane = yellow.
5. **Placido rings** follow real topography (rings compressed along the steep meridian, so the oval's long axis lies on the flat meridian), with the distortion exaggerated and labelled as such.
6. **Ray tracing.** 3D view: exact vector Snell refraction at the toric (paraboloid) surface normals. Cross-section: paraxial — rays converge exactly at `f_eff` so they meet the focal markers.
7. **Astigmatism type** (±30° rule on the minus-cylinder axis = meridian of the lower power): axis within 30° of 180° → With-the-Rule; within 30° of 90° → Against-the-Rule; otherwise Oblique. Zero cylinder → "None (spherical)". Axis 0° is displayed as 180°.

## 8. Direction Change (2026-10-11) — supersedes Sections 2, 4 and 5

The three-viewport layout was dropped. The app is now **one rotatable Three.js 3D model** (OrbitControls + camera preset buttons), built up incrementally.

* **Current files:** `index.html`, `css/styles.css`, `js/eyeModel.js` (geometry), `js/app.js` (scene, camera, controls, UI wiring).
* **Coordinates:** optical axis = world Z, corneal apex at the origin, anterior = +Z, units in mm.
* **Wall thickness:** the cornea, sclera, retina and iris are all 0.25 mm (`corneaThickness`, `scleraThickness`, `retinaThickness`, `irisThickness`).
* **Eye globe:** the sclera is strictly a half shell — cut in half by a plane through the optical axis (world x = 0, the x > 0 half removed so the solid half sits on the left in the front view) with a visible cut face. The **cornea is never cut**: it stays a complete 360° solid on the front.
* **Retina:** a 0.25 mm green layer lining the inner sclera of the same half, from the ora serrata (60° polar angle from the globe centre) to the back.
* **Cornea:** toric anterior surface driven by `#input-curvature-1`, `#input-curvature-2`, `#input-axis`. The surface is an elliptic paraboloid: along meridian φ, sag = k(φ)·r²/2 with Euler's k(φ) = k1·cos² + k2·sin² (φ from meridian 1, k = 1/R, R = 0.376/P). Paraboloid, not circular arcs, so heavy exaggeration never hits the hemisphere limit. **The eyeball never deforms** (user requirement, 2026-10-11): sclera, cut face and retina are static, and the limbus ring is fixed. The cornea apex is placed so the **most curved** meridian lands exactly on the fixed limbus (a clean curve edge to edge); every other meridian only needs pulling back at the rim, which adds curvature and never makes a reverse bend. From `limbalBlendStart` (0.45 × limbus radius) outward those meridians ease onto the fixed ring with a t² ramp (ease-in only). The posterior cornea (`posteriorY`) follows the anterior surface at a constant `corneaThickness`, bending back across the outer rim (ramp `(r/inner.r)^corneaRimRampPower`) to meet the fixed inner limbus. The inner limbus is the point on the inner sclera directly behind the anterior limbus, along the globe radius. The globe is sized from a 43.5 D reference cornea.
* **Curvature exaggeration (patient education):** on by default (`#input-exaggerate`). Drawn power = 43.5 + 5 × (true power − 43.5), floored at 5 D so the flattest meridian stays convex (38 D draws as 16 D, 50 D as 76 D). Readouts always show true values.
* **Meridian lines:** blue (Curvature 1) and red (Curvature 2) tubes lying on the anterior surface, limbus to limbus, always 90° apart.
* **Light rays — Astigmatism set** (`[data-ray-mode=astigmatism]`): two rays per principal meridian at ±2.5 mm (light blue `#7fc4ff` for Curvature 1, orange-red `#ff8a5c` for Curvature 2). They are parallel for vergence 0, otherwise they start on lines from a point source on the axis (`rayStart`). Each refracts at its entry point on the anterior surface and heads straight for that meridian's focal point on the axis (`focusPoint`). That point is paraxial: f = n/(P_drawn − vergence + accommodation), floored at 1 D net, and measured from the **fixed reference apex** `L.refApexY` (not the moving apex), so one meridian never shifts the other's focus. Focal depth uses the §7.1 teaching depth scale, computed so the 43.5 D reference cornea focuses exactly on the posterior pole of the nominal 24 mm eye. Solid tubes up to the (possibly stretched) retina, dotted beyond it: out to the focal point if it lies behind the retina (capped at `maxFocusDistance`, 60 mm behind the apex), otherwise a 4 mm stub.
* **Focus dots:** a camera-facing filled dot sprite (0.7 mm, ray colour, drawn on top) at each meridian's focal point, omitted when it lies beyond `maxFocusDistance`.
* **Light rays — Cataracts set** (`[data-ray-mode=cataract]`, `cataractRays`):
  * **Layout:** 95 warm-white rays: one on the axis, then rings 1 mm apart out to 5 mm, with ~1 mm between rays on each ring and alternate rings offset half a step.
  * **Path:** each ray refracts toward the focus of its own meridian (Euler curvature). When the iris is shown, it stops rays outside the pupil (checked at the flat iris front plane). Each ray then crosses the *current* lens shape (`sphereHit` on the front and back caps).
  * **Cataract effect:** after the lens, each ray is deflected by `scatter × (r/2.2 mm)²` degrees (r = radius where it leaves the lens, capped at 1), in a fixed pseudo-random direction (`hash`). Its opacity is `transmit`. A stage with `transmit` 0 stops rays at the lens front.
  * **Hidden parts:** a hidden lens counts as Clear, and a hidden iris blocks nothing.
  * **Ray modes:** `params.rayModes = { astigmatism, cataract }` from the checkboxes; either, both or neither. An empty ray list is not passed to `group.add` (it would log a three.js warning).
* **Retina-focus ticks:** a green tick under each curvature slider marks the true power whose rays focus on the retina's posterior pole for **distant light and a relaxed lens**: `EyeModel.retinaFocusPower(axialLength, exaggeration)`. It's the same for both sliders, independent of the other slider (because of the fixed focus reference), and hidden when off the 38–50 D range. At 24 mm it is 43.5 D.
* **Slider defaults:** both curvatures start at 43.5 D (`value` in `index.html`). That is where both meridians focus on the retina's posterior pole at 24 mm, because the depth scale is defined from the 43.5 D reference.
* **Reset button** (`#reset-curvatures`): sets both curvatures to `retinaFocusPower(axialLength, exaggeration)`, snapped to 0.25 D and clamped to the slider range. It also refreshes the lock's `previous` values so a locked drag afterwards doesn't jump.
* **Curvature lock:** `#input-lock-curvatures` (off by default). While on, moving either curvature slider moves the other by the same delta, so the cylinder stays constant. The delta is clamped so the other slider stays in 38–50 D. Its listener is registered before `updateCornea` so both values are set before the rebuild.
* **Axial length** (`#input-axial-length`, 20–30 mm, default 24 = `nominalAxialLength`): `updateCornea` rebuilds the globe (`buildGlobe`) when it changes. Only points behind the globe centre (y < cS) stretch along the axis, each surface of radius R by `1 + Δ/R`, so every posterior pole moves back by the same Δ and the wall stays 0.25 mm at the back. `retinaHit` intersects rays with the stretched retina by squashing into the unit sphere and back.
* **Vergence and accommodation:**
  * **Vergence** (`#input-vergence`, 0–10 D, step 0.25) is the divergence of the incoming light. It is drawn from a point source `vergenceSourceScale / V` (150/V mm) in front of the apex; the real distance 1000/V is compressed so the divergence is visible. The focus uses the true V, which isn't exaggerated.
  * **Accommodation** (`#input-accommodate`): the lens adds A = clamp(retinaDrawnPower − (mean drawn meridian power − V), 0, `maxAccommodation` = 7 D).
  * **Lens shape:** `setLensShape(eye, A / 7)` interpolates the lens from relaxed (front 10 / back 6 mm radius, 10 mm diameter) to accommodated (5.5 / 5 mm, 9 mm), with the front apex fixed (`LENS_APEX`). The current shape is `eye.userData.lensShape`.
  * **Readout:** `updateCornea` returns `accommodation` and `accommodationNeeded` for the readout.
* **Show toggles:** sidebar buttons (`[data-show="rays|lines|iris|lens"]`, `aria-pressed`, all on by default) call `EyeModel.setVisibility(eye, {...})`. Objects are tagged `userData.kind`; `applyVisibility` checks both the eye's direct children (iris, lens) and the cornea group's children. The state lives on `eye.userData.show` so it survives the cornea being rebuilt on every slider move. Any element with `data-show-for="<kind>"` (the ray checkboxes and the sub-sliders) is hidden while that toggle is off. The Iris / pupil button is pinned to grid column 1 so it always starts a new row below the ray checkboxes. With the Cataracts ray set on, toggling the iris or lens, or changing the pupil or cataract stage, also rebuilds the rays.
* **Iris / pupil (anatomy only):** a full 360° annulus whose front face is `irisDepth` (3.6 mm) behind the reference apex. It is 0.25 mm thick, and its outer radius equals the cornea's (`limbusR`). `#input-pupil` sets the pupil diameter (2–8 mm, step 0.5, default 5.5) via `EyeModel.setPupil(eye, diameter)`, which swaps the iris geometry. The iris's back face is `max(flat plane, lens front surface)`, so a small pupil drapes forward over the lens rather than cutting into it.
* **Lens:**
  * **Shape and position:** a full 360° biconvex lathe (relaxed: 10 mm diameter, front radius 10 mm, back radius 6 mm, sharp equator). It is seated so its front surface touches the iris back face at the default 2.75 mm pupil radius, and it reshapes with accommodation (see above).
  * **Drawing:** two meshes (BackSide, then FrontSide, `sideOrder` 0 / 0.25) share one geometry. Their `renderOrder` is set per frame by `orderForCamera`: base 1 (before the cornea's 2) when the camera is in front of the lens equator, 2.5 (after the cornea) when behind. Without that, the cornea shows through an opaque cataract seen from behind.
  * **Cataract stages:** `#input-cataract` (0–6, default 0) calls `EyeModel.setCataract(eye, stage)`, which sets colour, opacity and specular strength from `CATARACT_STAGES`: Clear, Yellowish, Yellow, Dark yellow, Brownish yellow, End stage, Leukocoria. Each stage also has `scatter` (deg) and `transmit` for the cataract rays.
  * **Optics:** the astigmatism rays pass through the lens geometrically unchanged. The lens's optical effect is modelled only as the accommodation power added to the focus, and as cataract scatter/fade in the Cataracts ray set. §1's "cornea-only" rule has been relaxed accordingly at the user's request.
* **Colour gotcha:** output is sRGB-encoded (r128), so a hex colour that must display exactly needs `convertSRGBToLinear()`.
* Optics decisions in Section 7 (focal formula, colours, axis convention, Curvature 1/2 naming) still apply when those features are added.
