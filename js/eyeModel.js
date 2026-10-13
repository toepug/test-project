// Eye geometry: sclera cut in half through the optical axis, with the whole cornea intact.
//
// Profiles are built in a local frame with y along the optical axis (corneal apex at
// y = 0, posterior is negative) and revolved with THREE.LatheGeometry. The finished group
// is rotated so the optical axis lies along world Z (anterior = +Z). A meridian angle θ
// (0° = world +X, 90° = world +Y, as seen from the front) maps to local (cos θ, ·, −sin θ).
const EyeModel = (() => {
  const N_CORNEA = 1.376;
  // Corneal power (D) ↔ anterior radius (mm): R = (n2 − n1) / P.
  const radiusFromPower = (P) => (1000 * (N_CORNEA - 1)) / P;

  // Dimensions in mm (schematic values).
  const DIM = {
    referencePower: 43.5,    // sizes the globe; the toric cornea is pinned to it at the limbus
    nominalAxialLength: 24,  // mm; the unstretched globe is labelled as this axial length
    corneaThickness: 0.25,      // drawn thickness (same as the sclera and retina), constant except across the outer rim
    corneaRimRampPower: 6,      // how late the posterior surface bends back to the inner limbus
    corneaDiameter: 11.7,
    scleraOuterR: 12.0,
    scleraThickness: 0.25,
    retinaThickness: 0.25,
    oraSerrataAngleDeg: 60,  // anterior edge of the retina, polar angle from the globe centre
    meridianLineRadius: 0.07,
    curvatureExaggeration: 5,   // drawn power = reference + k × (true power − reference)
    minDrawnPower: 5,           // D; floor so an exaggerated flat meridian never turns concave
    rayHeight: 2.5,             // mm from the axis where the parallel rays enter
    rayStartInFront: 10,        // mm in front of the apex where the rays begin
    rayRadius: 0.045,
    rayDotRadius: 0.06,
    rayDotSpacing: 0.45,
    rayStubBeyondRetina: 4,     // mm of dotted ray drawn past the retina when the focus is in front of it
    focusDotSize: 0.7,          // mm across the dot marking where a ray pair meets
    limbalBlendStart: 0.45,     // fraction of the limbus radius where meridians start easing onto the fixed limbus
    irisDepth: 3.6,             // mm behind the reference apex to the iris's front face
    irisThickness: 0.25,        // same as the cornea, sclera and retina
    pupilRadius: 2.75,          // default; just wider than rayHeight, so the rays pass through the pupil
    lensDiameter: 10,
    lensAnteriorR: 10,          // Gullstrand-style schematic radii; thickness follows from the diameter
    lensPosteriorR: 6,
    // Fully accommodated lens: rounder and slightly narrower (apex stays touching the iris).
    lensAccommodatedAnteriorR: 5.5,
    lensAccommodatedPosteriorR: 5,
    lensAccommodatedDiameter: 9,
    maxAccommodation: 7,        // D the lens can add; beyond it near light focuses behind the retina
    vergenceSourceScale: 150,   // mm·D: light of vergence V is drawn diverging from 150/V mm in front
                                // (truly 1000/V; compressed so the divergence is visible)
    maxFocusDistance: 60,       // mm behind the apex; a focus further back is not drawn
  };

  const COLORS = {
    sclera: 0xf1ebe1,
    scleraCut: 0xd9a99a,
    cornea: 0x9fd8ff,
    retina: 0x3fd07a,
    curvature1: 0x4d9bff, // blue
    curvature2: 0xff5a5a, // red
    rays1: 0x7fc4ff,      // lighter blue, for curvature 1's rays
    rays2: 0xff8a5c,      // orange-red, for curvature 2's rays
    raysCataract: 0xfff1b8, // warm white light, for the cataract ray fan
    iris: 0x6b4a2b,
  };

  // Cataract stages for the lens, clear to end stage (brunescent) to leukocoria (white).
  //  color/opacity: how the lens looks (sRGB colour);
  //  shine: strength of the white specular highlight, which dulls as the lens clouds over;
  //  scatter: max angle (deg) a cataract-mode ray is deflected leaving the lens;
  //  transmit: opacity of a cataract-mode ray beyond the lens (0 = blocked at the lens).
  const CATARACT_STAGES = [
    { name: 'Clear',           color: 0xeef6ff, opacity: 0.25, shine: 1,    scatter: 0,  transmit: 1 },
    { name: 'Yellowish',       color: 0xf5eaa8, opacity: 0.4,  shine: 0.7,  scatter: 2,  transmit: 0.8 },
    { name: 'Yellow',          color: 0xf2d64b, opacity: 0.5,  shine: 0.45, scatter: 5,  transmit: 0.6 },
    { name: 'Dark yellow',     color: 0xd9a91c, opacity: 0.62, shine: 0.25, scatter: 9,  transmit: 0.4 },
    { name: 'Brownish yellow', color: 0xa8741e, opacity: 0.78, shine: 0.12, scatter: 14, transmit: 0.22 },
    { name: 'End stage',       color: 0x5a3414, opacity: 0.93, shine: 0.05, scatter: 0,  transmit: 0 },
    { name: 'Leukocoria',      color: 0xf4f1e8, opacity: 0.96, shine: 0.1,  scatter: 0,  transmit: 0 },  // white pupil (mature white cataract)
  ];

  // Points on a circle centred on the axis at y = c, radius R, sweeping the polar
  // angle (measured from +y) from a0 to a1.
  function arc(c, R, a0, a1, steps) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push(new THREE.Vector2(R * Math.sin(a), c + R * Math.cos(a)));
    }
    return pts;
  }

  // Sag (depth behind the apex) of a sphere of radius R at height r.
  const sphereSag = (R, r) => R - Math.sqrt(R * R - r * r);

  function computeLayout() {
    const refR = radiusFromPower(DIM.referencePower);
    const limbusR = DIM.corneaDiameter / 2;
    const limbusY = -sphereSag(refR, limbusR);
    // Outer sclera passes through the anterior limbus.
    const cS = limbusY - Math.sqrt(DIM.scleraOuterR ** 2 - limbusR ** 2);
    const scleraInnerR = DIM.scleraOuterR - DIM.scleraThickness;
    // Posterior cornea meets the inner sclera directly behind the anterior limbus (along the
    // globe radius), so the join is no thicker than the sclera wall.
    const s = scleraInnerR / DIM.scleraOuterR;
    const inner = { r: limbusR * s, y: cS + (limbusY - cS) * s };
    const retinaR = scleraInnerR - DIM.retinaThickness;
    // Teaching depth scale for focal points (CLAUDE.md §7.1): a cornea alone focuses ~30 mm
    // back, behind any retina, so focal distances are scaled so the reference cornea focuses
    // exactly on the retina's posterior pole.
    const refK = 1 / refR;
    const refApexY = limbusY + (refK * limbusR * limbusR) / 2;
    const axialLength = refApexY - (cS - retinaR);
    const depthScale = axialLength / (N_CORNEA / (N_CORNEA - 1) / refK);
    return { limbusR, limbusY, cS, scleraInnerR, inner, retinaR, depthScale, refApexY };
  }

  const L = computeLayout();

  // ---------- Toric anterior cornea ----------
  // An elliptic paraboloid: along meridian φ the sag is k(φ)·r²/2, with Euler's formula
  // k(φ) = k1·cos² + k2·sin² (φ measured from meridian 1, k = 1/R). Paraboloid rather than
  // circular arcs so a heavily exaggerated meridian can't run out of "hemisphere".
  function meridianCurvature(phiDeg, cornea) {
    const d = THREE.MathUtils.degToRad(phiDeg - cornea.meridian1);
    return cornea.k1 * Math.cos(d) ** 2 + cornea.k2 * Math.sin(d) ** 2;
  }
  const paraboloidSag = (k, r) => (k * r * r) / 2;

  // The eyeball never moves: the sclera's limbus ring is fixed. The cornea meets it like this:
  //  - the apex sits at `offset`, chosen so the most curved meridian lands exactly on the
  //    fixed limbus;
  //  - inside the optical zone each meridian follows its own curvature exactly;
  //  - across the outer rim (limbalBlendStart → limbus) each meridian eases onto the fixed ring.
  function blendWeight(r) {
    const t = (r / L.limbusR - DIM.limbalBlendStart) / (1 - DIM.limbalBlendStart);
    // Ease-in only (t²): smooth where the blend starts, and no S-bend at the limbus.
    return t <= 0 ? 0 : t >= 1 ? 1 : t * t;
  }

  // Axial (y) position of the anterior surface at height r ≥ 0 along meridian φ.
  function anteriorY(r, phiDeg, cornea) {
    const k = meridianCurvature(phiDeg, cornea);
    const natural = cornea.offset - paraboloidSag(k, r);
    const edgeError = L.limbusY - (cornea.offset - paraboloidSag(k, L.limbusR));
    return natural + blendWeight(r) * edgeError;
  }

  // Posterior cornea: follows the anterior surface at a constant corneaThickness, then bends
  // back across the outer rim to meet the fixed inner limbus on the sclera.
  function posteriorY(r, phiDeg, cornea) {
    const rimGap = anteriorY(L.inner.r, phiDeg, cornea) - DIM.corneaThickness - L.inner.y;
    const ramp = (r / L.inner.r) ** DIM.corneaRimRampPower;
    return anteriorY(r, phiDeg, cornea) - DIM.corneaThickness - ramp * rimGap;
  }

  // Polar grid surface out to radius rMax; y(r, φ) gives its axial position.
  function surfaceGeometry(rMax, y) {
    const radial = 48, angular = 144;
    const pos = [], idx = [];
    for (let i = 0; i <= radial; i++) {
      const r = (rMax * i) / radial;
      for (let j = 0; j <= angular; j++) {
        const theta = (360 * j) / angular, t = THREE.MathUtils.degToRad(theta);
        pos.push(r * Math.cos(t), y(r, theta), -r * Math.sin(t));
      }
    }
    for (let i = 0; i < radial; i++) {
      for (let j = 0; j < angular; j++) {
        const a = i * (angular + 1) + j, b = a + angular + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  const anteriorGeometry = (cornea) => surfaceGeometry(L.limbusR, (r, phi) => anteriorY(r, phi, cornea));
  const posteriorGeometry = (cornea) => surfaceGeometry(L.inner.r, (r, phi) => posteriorY(r, phi, cornea));

  // Local-frame point on the anterior surface at signed height r along meridian θ.
  function anteriorPoint(r, thetaDeg, cornea, lift = 0) {
    const t = THREE.MathUtils.degToRad(thetaDeg);
    const phi = r >= 0 ? thetaDeg : thetaDeg + 180;
    return new THREE.Vector3(r * Math.cos(t), anteriorY(Math.abs(r), phi, cornea) + lift, -r * Math.sin(t));
  }

  // A thin tube lying on the anterior surface along meridian θ, limbus to limbus.
  function meridianLine(thetaDeg, cornea, color) {
    const pts = [];
    const steps = 96;
    for (let i = 0; i <= steps; i++) {
      const r = -L.limbusR + (2 * L.limbusR * i) / steps;
      pts.push(anteriorPoint(r, thetaDeg, cornea, DIM.meridianLineRadius));
    }
    const line = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 192, DIM.meridianLineRadius, 8, false),
      // Hex is an sRGB value; convert so the sRGB-encoded output shows it as written.
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).convertSRGBToLinear() })
    );
    line.renderOrder = 3; // after the translucent cornea, so it isn't tinted where it sits on top
    return line;
  }

  // params: { power1, power2, axis, exaggeration } — curvature 1 lies on `axis`, curvature 2 at
  // axis + 90°. The drawn radii exaggerate each power's distance from the reference power so
  // patients can see the difference; power1/power2 stay the true values.
  // Drawn curvature (1/mm) for a true power; the floor keeps the flattest exaggerated meridian convex.
  const drawnCurvature = (P, exaggeration) =>
    1 / radiusFromPower(Math.max(DIM.minDrawnPower, DIM.referencePower + exaggeration * (P - DIM.referencePower)));

  function corneaParams({ power1, power2, axis, exaggeration = 1 }) {
    const meridian1 = ((axis % 180) + 180) % 180;
    const k1 = drawnCurvature(power1, exaggeration), k2 = drawnCurvature(power2, exaggeration);
    // Apex height that lands the most curved meridian exactly on the fixed limbus, so it is a
    // clean curve edge to edge. Every other meridian then only needs pulling *back* at the rim,
    // which adds curvature and never creates a reverse bend.
    const offset = L.limbusY + paraboloidSag(Math.max(k1, k2), L.limbusR);
    return {
      power1, power2, meridian1,
      meridian2: (meridian1 + 90) % 180,
      k1, k2, offset,
    };
  }

  function disposeChildren(group) {
    for (const obj of [...group.children]) {
      group.remove(obj);
      if (!obj.isSprite) obj.geometry.dispose(); // sprites share one geometry across the scene
      if (obj.material !== group.userData.sharedMaterial) obj.material.dispose();
    }
  }

  // ---------- Light rays ----------
  // Two parallel rays per principal meridian, at ±rayHeight. Each refracts at the anterior
  // surface toward that meridian's (depth-scaled) focal point on the optical axis — paraxially,
  // a principal meridian's rays stay in its plane and meet at f = n / P.
  const rayMaterial = (hex) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).convertSRGBToLinear() });

  function tube(a, b, radius, material) {
    return new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, radius, 8, false), material);
  }

  // Far-side intersection of a ray with the retina sphere (local frame).
  // The retina behind the globe centre is stretched along the axis by `stretch`, so map the ray
  // into the unstretched sphere, intersect, and map back. Rays always hit behind the centre.
  function retinaHit(origin, dir, stretch) {
    const squash = (v, s) => new THREE.Vector3(v.x, v.y / s, v.z);
    const o = squash(origin.clone().sub(new THREE.Vector3(0, L.cS, 0)), stretch);
    const d = squash(dir, stretch);
    const a = d.lengthSq(), b = o.dot(d), c = o.lengthSq() - L.retinaR * L.retinaR;
    const t = (-b + Math.sqrt(Math.max(0, b * b - a * c))) / a;
    return origin.clone().addScaledVector(dir, t);
  }

  function dottedLine(a, b, material) {
    const length = a.distanceTo(b);
    const count = Math.max(1, Math.floor(length / DIM.rayDotSpacing));
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(DIM.rayDotRadius, 8, 6), material, count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      m.makeTranslation(...a.clone().lerp(b, (i + 0.5) / count).toArray());
      dots.setMatrixAt(i, m);
    }
    return dots;
  }

  // Drawn power (D) of a curvature k (1/mm).
  const powerOf = (k) => k * 1000 * (N_CORNEA - 1);

  // Focal point on the axis for a meridian of curvature k. The vergence of the incoming light
  // (cornea.vergence, D of divergence) subtracts from the power and the lens's accommodation
  // (cornea.accommodation, D) adds to it. Measured from the fixed reference apex, not the moving
  // one (cornea.offset): the apex shifts with whichever meridian is most curved, and that must
  // not move the other meridian's focus. Net power is floored at 1 D so the point stays finite.
  function focusPoint(k, cornea) {
    const net = Math.max(1, powerOf(k) - cornea.vergence + cornea.accommodation);
    const focalDistance = (L.depthScale * N_CORNEA * 1000) / net;
    return new THREE.Vector3(0, L.refApexY - focalDistance, 0);
  }
  const focusDrawn = (focus) => L.refApexY - focus.y <= DIM.maxFocusDistance;

  // Where a ray that hits the cornea at `hit` starts: parallel to the axis for vergence 0,
  // otherwise on the line from the diverging point source on the axis (vergenceSourceScale / V in
  // front of the apex), rayStartInFront ahead of the apex or at the source if that is nearer.
  function rayStart(hit, cornea) {
    const startY = cornea.offset + DIM.rayStartInFront;
    if (!cornea.vergence) return new THREE.Vector3(hit.x, startY, hit.z);
    const source = new THREE.Vector3(0, cornea.offset + DIM.vergenceSourceScale / cornea.vergence, 0);
    if (source.y <= startY) return source;
    return source.clone().lerp(hit, (source.y - startY) / (source.y - hit.y));
  }

  function meridianRays(thetaDeg, k, cornea, hex) {
    const material = rayMaterial(hex);
    const focus = focusPoint(k, cornea);
    const objects = [];
    for (const h of [DIM.rayHeight, -DIM.rayHeight]) {
      const hit = anteriorPoint(h, thetaDeg, cornea);
      const dir = focus.clone().sub(hit).normalize();
      const onRetina = retinaHit(hit, dir, cornea.retinaStretch);
      objects.push(tube(rayStart(hit, cornea), hit, DIM.rayRadius, material));
      objects.push(tube(hit, onRetina, DIM.rayRadius, material));
      // Beyond the retina: dotted, out to the focal point if it lies behind the retina (or as far
      // as a focus is drawn), otherwise a short stub showing the ray carrying on.
      const toFocus = focus.clone().sub(onRetina).dot(dir);
      const farthest = DIM.maxFocusDistance - (L.refApexY - onRetina.y);
      const dotted = toFocus > 0 ? Math.min(toFocus, farthest) : DIM.rayStubBeyondRetina;
      objects.push(dottedLine(onRetina, onRetina.clone().addScaledVector(dir, dotted), material));
    }
    if (focusDrawn(focus)) objects.push(focusDot(focus, hex));
    return objects;
  }

  // Small filled dot at a focal point. A sprite always faces the camera, so it reads as a round
  // dot from any angle.
  let dotTexture;
  function focusDot(position, hex) {
    if (!dotTexture) {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      dotTexture = new THREE.CanvasTexture(canvas);
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dotTexture, color: new THREE.Color(hex).convertSRGBToLinear(), depthTest: false,
    }));
    sprite.position.copy(position);
    sprite.scale.setScalar(DIM.focusDotSize);
    sprite.renderOrder = 4;
    return sprite;
  }

  // ---------- Iris and lens (anatomy only: the optics stay cornea-only, CLAUDE.md §1) ----------
  // Both are full 360° like the cornea, and are fixed to the static eyeball.

  // Lens: fixed in place. Relaxed, it is seated so its front surface touches the back of the iris
  // at the default pupil margin, so it bulges slightly into the pupil. Accommodating (t from 0 to
  // 1 of maxAccommodation), it rounds up towards the accommodated radii and diameter, with its
  // front apex staying put.
  const IRIS_BACK = L.refApexY - DIM.irisDepth - DIM.irisThickness;
  const LENS_APEX = IRIS_BACK + sphereSag(DIM.lensAnteriorR, DIM.pupilRadius);
  function lensShape(t) {
    const mix = (a, b) => a + (b - a) * t;
    const Ra = mix(DIM.lensAnteriorR, DIM.lensAccommodatedAnteriorR);
    const Rp = mix(DIM.lensPosteriorR, DIM.lensAccommodatedPosteriorR);
    const rEq = mix(DIM.lensDiameter, DIM.lensAccommodatedDiameter) / 2;
    const thickness = sphereSag(Ra, rEq) + sphereSag(Rp, rEq);
    const cA = LENS_APEX - Ra;
    return { t, Ra, Rp, rEq, cA, cB: LENS_APEX - thickness + Rp, equatorY: cA + Math.sqrt(Ra * Ra - rEq * rEq) };
  }
  const LENS_RELAXED = lensShape(0);
  // The iris drapes over the relaxed lens; accommodation only pulls the lens surface back from it.
  const lensFrontY = (r) =>
    r < LENS_RELAXED.rEq ? LENS_RELAXED.cA + Math.sqrt(LENS_RELAXED.Ra ** 2 - r * r) : -Infinity;

  // Iris: an annulus from the pupil out to the cornea's diameter. It is flat, except that a pupil
  // smaller than the default makes its inner part rest on the lens, curving slightly forward.
  // Each face/edge segment repeats its end points, so the lathe keeps hard edges at the corners.
  function irisGeometry(pupilRadius) {
    const steps = 24;
    const back = (r) => Math.max(IRIS_BACK, lensFrontY(r));
    const front = (r) => back(r) + DIM.irisThickness;
    const radii = Array.from({ length: steps + 1 }, (_, i) => pupilRadius + ((L.limbusR - pupilRadius) * i) / steps);
    const v = (r, y) => new THREE.Vector2(r, y);
    const profile = [
      ...radii.map((r) => v(r, front(r))),
      v(L.limbusR, front(L.limbusR)), v(L.limbusR, back(L.limbusR)),
      ...[...radii].reverse().map((r) => v(r, back(r))),
      v(pupilRadius, back(pupilRadius)), v(pupilRadius, front(pupilRadius)),
    ];
    return new THREE.LatheGeometry(profile, 96);
  }

  function iris() {
    const mesh = new THREE.Mesh(
      irisGeometry(DIM.pupilRadius),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(COLORS.iris).convertSRGBToLinear(), roughness: 0.8, side: THREE.DoubleSide,
      })
    );
    mesh.userData.kind = 'iris';
    return mesh;
  }

  // Resize the pupil (diameter in mm).
  function setPupil(eye, diameter) {
    eye.userData.pupilRadius = diameter / 2;
    const mesh = eye.userData.iris;
    mesh.geometry.dispose();
    mesh.geometry = irisGeometry(diameter / 2);
  }

  // Biconvex lens: two spherical caps meeting at a sharp equator.
  function lensGeometry(shape) {
    return new THREE.LatheGeometry([
      ...arc(shape.cA, shape.Ra, 0, Math.asin(shape.rEq / shape.Ra), 32),
      ...arc(shape.cB, shape.Rp, Math.PI - Math.asin(shape.rEq / shape.Rp), Math.PI, 32),
    ], 96);
  }

  function lens() {
    // Translucent and closed: draw the far side first, then the near side, so its own faces
    // never sort over each other. Whether it draws before or after the translucent cornea is
    // set per frame by orderForCamera().
    const geometry = lensGeometry(LENS_RELAXED);
    const group = new THREE.Group();
    [THREE.BackSide, THREE.FrontSide].forEach((side, i) => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
        transparent: true, shininess: 80, side, depthWrite: false, // specular set by setCataract
      }));
      mesh.userData.sideOrder = i * 0.25;
      group.add(mesh);
    });
    group.userData.kind = 'lens';
    return group;
  }

  // Reshape the lens for an accommodation fraction t (0 relaxed, 1 fully accommodated).
  function setLensShape(eye, t) {
    if (eye.userData.lensShape.t === t) return;
    eye.userData.lensShape = lensShape(t);
    const [back, front] = eye.userData.lens.children;
    back.geometry.dispose();
    back.geometry = front.geometry = lensGeometry(eye.userData.lensShape);
  }

  // Draw order of the translucent lens against the translucent cornea (renderOrder 2), which
  // depends on which side the camera is on. Without depth writes, whichever draws last shows on
  // top, so the nearer one must draw last: from the front the lens draws first, from behind the
  // cornea draws first (otherwise it shows through an opaque cataract).
  const _cam = new THREE.Vector3();
  function orderForCamera(eye, camera) {
    const cameraY = eye.worldToLocal(_cam.copy(camera.position)).y;
    const base = cameraY > eye.userData.lensShape.equatorY ? 1 : 2.5;
    for (const mesh of eye.userData.lens.children) mesh.renderOrder = base + mesh.userData.sideOrder;
  }

  // Colour the lens for a cataract stage (index into CATARACT_STAGES).
  function setCataract(eye, stage) {
    eye.userData.cataractStage = stage;
    const { color, opacity, shine } = CATARACT_STAGES[stage];
    for (const { material } of eye.userData.lens.children) {
      material.color.set(color).convertSRGBToLinear();
      material.opacity = opacity;
      material.specular.setScalar(shine);
    }
  }

  // ---------- Cataract rays ----------
  // Parallel rays entering across the whole cornea, evenly spaced: one on the axis, then rings
  // `spacing` apart with about `spacing` between neighbours on each ring. Each refracts at the
  // cornea toward the focus of its own meridian, as in the astigmatism rays. The iris stops any
  // ray outside the pupil. Through the lens, each ray leaves in a slightly scattered direction and
  // fainter, by the cataract stage; a blocking stage stops it at the lens front. A hidden lens
  // counts as clear, and a hidden iris blocks nothing.
  const CATARACT_RAY_SPACING = 1;      // mm
  const CATARACT_RAY_MAX_RADIUS = 5;   // mm (the cornea's radius is 5.85)
  // Scatter grows from the centre of the lens outward: none for a ray through the middle, rising
  // with the square of the distance to all of the stage's scatter at SCATTER_FULL_RADIUS (about
  // where the outermost rays through the default pupil leave the lens).
  const SCATTER_FULL_RADIUS = 2.2;     // mm from the axis, where the ray leaves the lens
  const CATARACT_RAY_GRID = (() => {
    const pts = [{ r: 0, theta: 0 }];
    for (let ring = 1; ring * CATARACT_RAY_SPACING <= CATARACT_RAY_MAX_RADIUS; ring++) {
      const n = Math.round(2 * Math.PI * ring);
      // Alternate rings are offset half a step so the pattern doesn't line up into spokes.
      for (let m = 0; m < n; m++) pts.push({ r: ring * CATARACT_RAY_SPACING, theta: (360 * (m + (ring % 2) / 2)) / n });
    }
    return pts;
  })();

  // Point where a ray meets an axis-centred sphere (centre y = cy, radius R): the near or far hit.
  function sphereHit(origin, dir, cy, R, far) {
    const oc = origin.clone().sub(new THREE.Vector3(0, cy, 0));
    const b = oc.dot(dir), c = oc.lengthSq() - R * R;
    const t = -b + (far ? 1 : -1) * Math.sqrt(Math.max(0, b * b - c));
    return origin.clone().addScaledVector(dir, t);
  }

  // Fixed pseudo-random number in [0, 1) per ray and channel, so the scatter pattern holds still
  // and only grows as the cataract worsens.
  const hash = (i, j) => {
    const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  function scatterDirection(dir, i, scatterDeg) {
    if (!scatterDeg) return dir.clone();
    const e1 = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize();
    const e2 = new THREE.Vector3().crossVectors(dir, e1);
    const psi = 2 * Math.PI * hash(i, 1);
    const angle = THREE.MathUtils.degToRad(scatterDeg) * (0.3 + 0.7 * hash(i, 2));
    const sideways = e1.multiplyScalar(Math.cos(psi)).addScaledVector(e2, Math.sin(psi));
    return dir.clone().multiplyScalar(Math.cos(angle)).addScaledVector(sideways, Math.sin(angle)).normalize();
  }

  function cataractRays(eye, cornea) {
    const show = eye.userData.show;
    const stage = CATARACT_STAGES[show.lens ? eye.userData.cataractStage : 0];
    const material = rayMaterial(COLORS.raysCataract);
    const faded = new THREE.MeshBasicMaterial({
      color: new THREE.Color(COLORS.raysCataract).convertSRGBToLinear(),
      transparent: true, opacity: stage.transmit, depthWrite: false,
    });
    const irisFront = IRIS_BACK + DIM.irisThickness;
    const lensNow = eye.userData.lensShape;
    const objects = [];
    CATARACT_RAY_GRID.forEach(({ r, theta }, i) => {
      const focus = focusPoint(meridianCurvature(theta, cornea), cornea);
      const hit = anteriorPoint(r, theta, cornea);
      const dir = focus.clone().sub(hit).normalize();
      objects.push(tube(rayStart(hit, cornea), hit, DIM.rayRadius, material));

      const atIris = hit.clone().addScaledVector(dir, (irisFront - hit.y) / dir.y);
      if (show.iris && Math.hypot(atIris.x, atIris.z) > eye.userData.pupilRadius) {
        objects.push(tube(hit, atIris, DIM.rayRadius, material));
        return;
      }
      const lensIn = sphereHit(hit, dir, lensNow.cA, lensNow.Ra, false);
      if (stage.transmit === 0) {
        objects.push(tube(hit, lensIn, DIM.rayRadius, material));
        return;
      }
      const lensOut = sphereHit(hit, dir, lensNow.cB, lensNow.Rp, true);
      objects.push(tube(hit, lensOut, DIM.rayRadius, material));
      const outward = Math.min(1, Math.hypot(lensOut.x, lensOut.z) / SCATTER_FULL_RADIUS);
      const out = scatterDirection(dir, i, stage.scatter * outward * outward);
      const onRetina = retinaHit(lensOut, out, cornea.retinaStretch);
      objects.push(tube(lensOut, onRetina, DIM.rayRadius, stage.transmit < 1 ? faded : material));
    });
    return objects;
  }

  // ---------- Axial length ----------
  // Only the globe behind its centre stretches along the axis, so the front of the eye (cornea,
  // limbus, iris, lens) never moves. Each surface of radius R stretches by 1 + Δ/R, so every
  // posterior pole moves back by the same Δ = axialLength − nominal and the walls keep their
  // thickness there. At the equator the profile is vertical, so the join stays smooth.
  const stretchFor = (axialLength, R) => 1 + (axialLength - DIM.nominalAxialLength) / R;
  const stretchProfile = (pts, R, axialLength) => {
    const s = stretchFor(axialLength, R);
    return pts.map((p) => (p.y < L.cS ? new THREE.Vector2(p.x, L.cS + (p.y - L.cS) * s) : p));
  };

  // True power at which a meridian's rays focus exactly on the retina's posterior pole. Focal
  // points are measured from the fixed reference apex, and the depth scale is defined so the
  // reference cornea focuses on the pole of the nominal eye; a longer eye needs a flatter cornea.
  // (For parallel light and a relaxed lens.)
  function retinaFocusPower(axialLength = DIM.nominalAxialLength, exaggeration = 1) {
    return DIM.referencePower + (retinaDrawnPower(axialLength) - DIM.referencePower) / exaggeration;
  }

  // Drawn (net) power that focuses on the retina's posterior pole for this axial length.
  function retinaDrawnPower(axialLength) {
    const poleY = L.cS - L.retinaR - (axialLength - DIM.nominalAxialLength);
    return (L.depthScale * N_CORNEA * 1000) / (L.refApexY - poleY);
  }

  // Rebuild the cornea, its two principal-meridian lines and their light rays.
  function updateCornea(eye, params) {
    const cornea = corneaParams(params);
    const axialLength = params.axialLength ?? DIM.nominalAxialLength;
    if (axialLength !== eye.userData.axialLength) buildGlobe(eye, axialLength);
    cornea.retinaStretch = stretchFor(axialLength, L.retinaR);

    // Near light (params.vergence, D of divergence) pushes the focus back. With
    // params.accommodate, the lens adds the power that brings the average of the two principal
    // meridians back onto the retina, up to maxAccommodation; past that the focus slips back.
    // It never adds less than 0 (a lens can't relax beyond flat-out).
    cornea.vergence = params.vergence ?? 0;
    const needed = retinaDrawnPower(axialLength) - ((powerOf(cornea.k1) + powerOf(cornea.k2)) / 2 - cornea.vergence);
    cornea.accommodationNeeded = Math.max(0, needed);
    cornea.accommodation = params.accommodate ? Math.min(cornea.accommodationNeeded, DIM.maxAccommodation) : 0;
    setLensShape(eye, cornea.accommodation / DIM.maxAccommodation);

    const group = eye.userData.cornea;
    disposeChildren(group);
    const mat = group.userData.sharedMaterial;

    group.add(new THREE.Mesh(anteriorGeometry(cornea), mat));
    group.add(new THREE.Mesh(posteriorGeometry(cornea), mat));
    // Edge band between the fixed anterior and posterior limbus rings.
    group.add(new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(L.limbusR, L.limbusY), new THREE.Vector2(L.inner.r, L.inner.y),
    ], 144), mat));
    for (const m of group.children) m.renderOrder = 2;

    const tag = (kind, objects) => {
      for (const o of objects) o.userData.kind = kind;
      return objects;
    };
    group.add(...tag('lines', [
      meridianLine(cornea.meridian1, cornea, COLORS.curvature1),
      meridianLine(cornea.meridian2, cornea, COLORS.curvature2),
    ]));
    // Ray sets, either or both: params.rayModes = { astigmatism, cataract }. Astigmatism: the
    // principal-meridian rays and focus dots; cataract: the bundle across the whole cornea.
    const { astigmatism = true, cataract = false } = params.rayModes ?? {};
    const rays = tag('rays', [
      ...(astigmatism ? meridianRays(cornea.meridian1, cornea.k1, cornea, COLORS.rays1) : []),
      ...(astigmatism ? meridianRays(cornea.meridian2, cornea.k2, cornea, COLORS.rays2) : []),
      ...(cataract ? cataractRays(eye, cornea) : []),
    ]);
    if (rays.length) group.add(...rays); // add() with no objects logs a warning
    applyVisibility(eye);
    return cornea;
  }

  // Show or hide the curvature lines and light rays: setVisibility(eye, { lines, rays }).
  // The setting is kept on the eye so it survives the cornea being rebuilt.
  function setVisibility(eye, show) {
    Object.assign(eye.userData.show, show);
    applyVisibility(eye);
  }

  function applyVisibility(eye) {
    for (const obj of [...eye.children, ...eye.userData.cornea.children]) {
      const kind = obj.userData.kind;
      if (kind) obj.visible = eye.userData.show[kind];
    }
  }

  // Sclera (half shell with its cut face) and retina, stretched for the axial length (mm).
  const globeMaterials = (() => {
    const retina = new THREE.MeshStandardMaterial({ color: COLORS.retina, roughness: 0.7, side: THREE.DoubleSide });
    const retinaCut = retina.clone();
    // Cut face 20% darker than the retina surface, measured on screen (output is sRGB-encoded).
    retinaCut.color.convertLinearToSRGB().multiplyScalar(0.8).convertSRGBToLinear();
    return {
      sclera: new THREE.MeshStandardMaterial({ color: COLORS.sclera, roughness: 0.6, side: THREE.DoubleSide }),
      scleraCut: new THREE.MeshStandardMaterial({ color: COLORS.scleraCut, roughness: 0.8, side: THREE.DoubleSide }),
      retina, retinaCut,
    };
  })();

  function buildGlobe(eye, axialLength) {
    const globe = eye.userData.globe;
    for (const obj of [...globe.children]) {
      globe.remove(obj);
      obj.geometry.dispose();
    }
    eye.userData.axialLength = axialLength;
    const M = globeMaterials;
    const profile = (R, a0, a1, steps) => stretchProfile(arc(L.cS, R, a0, a1, steps), R, axialLength);
    // A cut-face section between two surfaces, turned from the XY plane into the lathe's x = 0 plane.
    const section = (outer, inner, material) => new THREE.Mesh(
      new THREE.ShapeGeometry(new THREE.Shape([...outer, ...inner.reverse()]), 1).rotateY(Math.PI / 2), material);

    // Polar angles (from +y, about the globe centre) of the limbus points on the sclera.
    const aScleraOuter = Math.atan2(L.limbusR, L.limbusY - L.cS);
    const aScleraInner = Math.atan2(L.inner.r, L.inner.y - L.cS);

    // --- Sclera: half shell (lathe phi π..2π keeps the x < 0 half), outer and inner surfaces.
    globe.add(new THREE.Mesh(
      new THREE.LatheGeometry(profile(DIM.scleraOuterR, aScleraOuter, Math.PI, 96), 64, Math.PI, Math.PI), M.sclera));
    globe.add(new THREE.Mesh(
      new THREE.LatheGeometry(profile(L.scleraInnerR, aScleraInner, Math.PI, 96), 64, Math.PI, Math.PI), M.sclera));
    // --- Cut face: the C-shaped meridional section of the shell, in the lathe's phi = 0 / π plane.
    globe.add(section(
      profile(DIM.scleraOuterR, aScleraOuter, 2 * Math.PI - aScleraOuter, 192),
      profile(L.scleraInnerR, aScleraInner, 2 * Math.PI - aScleraInner, 192), M.scleraCut));

    // --- Retina: thin layer lining the inner sclera from the ora serrata back, same half as the sclera.
    const aOra = THREE.MathUtils.degToRad(DIM.oraSerrataAngleDeg);
    globe.add(new THREE.Mesh(
      new THREE.LatheGeometry(profile(L.retinaR, aOra, Math.PI, 96), 64, Math.PI, Math.PI), M.retina));
    // Its edge on the cut face, so the layer reads in section.
    globe.add(section(
      profile(L.scleraInnerR, aOra, 2 * Math.PI - aOra, 192),
      profile(L.retinaR, aOra, 2 * Math.PI - aOra, 192), M.retinaCut));
  }

  function build() {
    const group = new THREE.Group();

    // --- Cornea: full 360°, rebuilt by updateCornea().
    const corneaGroup = new THREE.Group();
    corneaGroup.userData.sharedMaterial = new THREE.MeshPhongMaterial({
      color: COLORS.cornea, transparent: true, opacity: 0.35, shininess: 120,
      specular: 0xffffff, side: THREE.DoubleSide, depthWrite: false,
    });
    group.add(corneaGroup);
    group.userData.cornea = corneaGroup;
    group.userData.show = { lines: true, rays: true, iris: true, lens: true };

    group.userData.globe = new THREE.Group();
    group.add(group.userData.globe);
    buildGlobe(group, DIM.nominalAxialLength);

    group.userData.pupilRadius = DIM.pupilRadius;
    group.userData.iris = iris();
    group.userData.lens = lens();
    group.userData.lensShape = LENS_RELAXED;
    group.add(group.userData.iris, group.userData.lens);
    setCataract(group, 0);
    applyVisibility(group);

    // Optical axis along world Z, anterior toward +Z.
    group.rotation.x = Math.PI / 2;
    // Centre of the globe, for framing the camera.
    group.userData.center = new THREE.Vector3(0, 0, L.cS);
    group.userData.radius = DIM.scleraOuterR;
    return group;
  }

  return { build, updateCornea, setVisibility, setPupil, setCataract, orderForCamera, retinaFocusPower, DIM, COLORS, CATARACT_STAGES };
})();
