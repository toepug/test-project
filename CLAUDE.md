# Product Specification: Corneal Astigmatism Optics Visualizer

## 0. Current Status & Handoff (updated 2026-10-11, evening) — read this first

**Purpose:** a patient-education tool that shows what corneal astigmatism is. It is a single rotatable Three.js 3D eye, not the three-viewport app described in Sections 2, 4 and 5. Those sections are superseded by Section 8, which holds the authoritative details of the current model. Section 7 decisions still apply where noted.

### What exists now
* `index.html`: top bar with camera presets (45° / Front / Side / Top). The left sidebar has:
  * the Curvature 1 and Curvature 2 sliders (38–50 D, **default 43.5 D**, the retina-focus point) with green retina-focus ticks;
  * a **"Lock curvatures together"** checkbox;
  * the Axis slider and the "Exaggerate curvature (×5)" checkbox;
  * four Show toggles in a 2×2 grid: Light rays, Curvature lines, **Iris / pupil**, **Lens**. Under Iris / pupil sits a **Pupil** slider (2–8 mm), and under Lens a **Cataract** slider (6 stages). Each slider shows only while its part is shown;
  * the readouts: cylinder, WTR/ATR/Oblique type, and each curvature's power @ meridian.
* `js/eyeModel.js`: all geometry and optics. Exports `build, updateCornea, setVisibility, setPupil, setCataract, retinaFocusPower, DIM, COLORS, CATARACT_STAGES`.
  * Static half-shell sclera and green retina. The cornea, sclera, retina and iris are all **0.25 mm** thick.
  * An uncut toric cornea (elliptic paraboloid, exaggerated ×5) whose edge is fixed to the eyeball.
  * Blue and red meridian lines, plus light rays with focus dots.
  * An iris with an adjustable pupil, and a lens with cataract stages. Both are **anatomy only**: the rays ignore them.
* `js/app.js`: scene, lights, OrbitControls, camera presets, slider and readout wiring, curvature lock, show toggles (and their sub-sliders), pupil and cataract wiring, retina-focus tick placement.
* `css/styles.css`: dark UI.

### Changes made in the 2026-10-11 evening session (in order)
1. Both curvature sliders now default to 43.5 D, where both meridians focus on the retina (no astigmatism at start).
2. Added the Iris / pupil and Lens show toggles; the toggle row became a 2×2 grid.
3. Set the iris diameter to the cornea's (11.7 mm), not out to the sclera wall. This leaves a small gap (≤0.8 mm) between the iris root and the sclera.
4. Added "Lock curvatures together". Moving either slider moves the other by the same amount, so the cylinder stays constant. The move is clamped so neither slider passes its end.
5. Thinned the eye: the cornea, sclera and iris are now 0.25 mm, matching the retina.
   * The posterior cornea now follows the anterior surface at constant thickness, bending back only near the rim (`posteriorY`, `corneaRimRampPower`).
   * The inner limbus is now the point on the inner sclera directly behind the anterior limbus. The old schematic posterior sphere (`corneaPosteriorR`, `corneaCentralThickness`, `circleIntersection`) was removed.
   * The thinner sclera moved the retina ~0.75 mm outward. The depth scale is recomputed from it automatically, so 43.5 D still focuses on the retina.
6. Added the Pupil slider (2–8 mm, default 5.5 mm). The lens stays fixed. A pupil smaller than the default makes the inner iris drape forward over the lens instead of intersecting it.
7. Added the Cataract slider: Clear → Yellowish → Yellow → Dark yellow → Brownish yellow → End stage (`CATARACT_STAGES`: colour plus opacity; the default is Clear). The lens is drawn as two meshes, back faces then front faces, to avoid transparency-sorting artefacts.

### Next steps / open ideas (confirm with the user before building)
* **Commit and push this session's work first** if it isn't already (check `git status`; see Environment). Then `git pull` on the other laptop.
* Pupil slider below ~5 mm: the rays (fixed at ±2.5 mm) visibly pass through the iris. Options: let the iris block the rays, or scale the ray height to the pupil.
* The lens and cataract don't affect the rays. Consider a note on screen, or dimming the rays with cataract stage, if that is wanted for teaching.
* The iris-to-sclera gap from change 3 can be closed by moving the iris forward or sloping its outer edge, if the user wants.
* Front view: two overlapping translucent cornea layers wash out the inner iris slightly (a cosmetic issue that predates these changes).
* Earlier feature ideas, still open: rays for oblique meridians; a visible Sturm's interval / circle of least confusion; an eye-length slider; a camera preset showing both meridian profiles; on-screen labels for patients; a patient mode that hides the clinical readouts.
* Known limitations: the rays are paraxial (aimed at the focal point); focal depth uses the teaching depth scale (§7.1); the focus dots draw on top (`depthTest: false`); sliders step in 0.25 D, so a retina tick can't always be hit exactly.
* Unused spec items not yet ported: ray density, selected cross-section plane, Placido rings.

### Environment & commands
* **No build step, no package manager.** Open `index.html` directly in a browser (double-click or `start index.html`). An internet connection is required because Three.js r128 and OrbitControls load from CDNs.
* **Git:** remote `origin` = `https://github.com/toepug/test-project.git`, branch `main`. Everything is tracked. Commit and push to sync:
  ```
  git add -A
  git commit -m "Iris/pupil, lens/cataract, curvature lock, thinner eye walls"
  git push origin main
  ```
  On the other laptop: `git pull` (or `git clone https://github.com/toepug/test-project.git`).
* **Two machines:**
  * Laptop A has the project at `C:\dev\test-project` and no Node.js or Python.
  * Laptop B has it at `C:\Users\jason\dev\test-project`, with Python 3.13 (no Pillow) and no Node.js.
  * Neither machine has Edge on PATH. It is at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.
* **Visual checks (headless Edge screenshots):**
  1. Copy `index.html` to a scratch folder with `<base href="file:///<project path>/">` inserted after `<head>`.
  2. Optionally add a `<script>` before `</body>` that sets sliders (set `.value`, then `dispatchEvent(new Event('input'))`) or clicks buttons (for example `document.querySelector('[data-view=side]').click()`).
  3. Run:
     ```
     "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --window-size=1300,800 --virtual-time-budget=4000 --user-data-dir=<scratch>\edge-profile --screenshot=<scratch>\shot.png --enable-logging=stderr --v=0 file:///<scratch>/page.html 2> <scratch>\log.txt
     ```
  4. Search the log for `Uncaught` or `THREE.` warnings. Use `console.log(...)` in the injected script to read values back from the log. The "Tracking Prevention blocked access to storage" lines are harmless.
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
* **Light rays:** two parallel rays per principal meridian at ±2.5 mm (light blue `#7fc4ff` for Curvature 1, orange-red `#ff8a5c` for Curvature 2). Each refracts at its entry point on the anterior surface and heads straight for that meridian's focal point on the axis (paraxial principal-meridian focus, f = n/P using the *drawn* curvature). Focal depth uses the §7.1 teaching depth scale, computed so the 43.5 D reference cornea focuses exactly on the retina's posterior pole. Solid tubes up to the retina sphere, dotted beyond it: out to the focal point if it lies behind the retina, otherwise a 4 mm stub.
* **Focus dots:** a camera-facing filled dot sprite (0.7 mm, ray colour, drawn on top) at each meridian's focal point.
* **Retina-focus ticks:** a green tick under each curvature slider marks the true power whose rays focus on the retina's posterior pole (`EyeModel.retinaFocusPower(otherPower, exaggeration)`). It depends on the other slider because the apex position is set by the more curved meridian, and on the exaggeration setting; hidden when off the 38–50 D range.
* **Slider defaults:** both curvatures start at 43.5 D (`value` in `index.html`). That is where both meridians focus on the retina's posterior pole, because the depth scale is defined from the 43.5 D reference.
* **Curvature lock:** `#input-lock-curvatures` (off by default). While on, moving either curvature slider moves the other by the same delta, so the cylinder stays constant. The delta is clamped so the other slider stays in 38–50 D. Its listener is registered before `updateCornea` so both values are set before the rebuild.
* **Show toggles:** sidebar buttons (`[data-show="rays|lines|iris|lens"]`, `aria-pressed`, all on by default) call `EyeModel.setVisibility(eye, {...})`. Objects are tagged `userData.kind`; `applyVisibility` checks both the eye's direct children (iris, lens) and the cornea group's children. The state lives on `eye.userData.show` so it survives the cornea being rebuilt on every slider move. Any element with `data-show-for="<kind>"` (the sub-sliders) is hidden while that toggle is off.
* **Iris / pupil (anatomy only):** a full 360° annulus whose front face is `irisDepth` (3.6 mm) behind the reference apex. It is 0.25 mm thick, and its outer radius equals the cornea's (`limbusR`). `#input-pupil` sets the pupil diameter (2–8 mm, step 0.5, default 5.5) via `EyeModel.setPupil(eye, diameter)`, which swaps the iris geometry. The iris's back face is `max(flat plane, lens front surface)`, so a small pupil drapes forward over the lens rather than cutting into it.
* **Lens (anatomy only):** a full 360° biconvex lathe: 10 mm diameter, front radius 10 mm, back radius 6 mm, sharp equator. It is fixed in place (`LENS`), seated so its front surface touches the iris back face at the default 2.75 mm pupil radius. It is drawn as two meshes (BackSide, then FrontSide, `renderOrder` 1 / 1.5, below the cornea's 2) to avoid self-sorting artefacts. `#input-cataract` (0–5, default 0) calls `EyeModel.setCataract(eye, stage)`, which sets colour and opacity from `CATARACT_STAGES`: Clear, Yellowish, Yellow, Dark yellow, Brownish yellow, End stage. Rays pass through the iris and lens unaffected; the optics stay cornea-only (§1).
* **Colour gotcha:** output is sRGB-encoded (r128), so a hex colour that must display exactly needs `convertSRGBToLinear()`.
* Optics decisions in Section 7 (focal formula, colours, axis convention, Curvature 1/2 naming) still apply when those features are added.
