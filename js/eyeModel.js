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
    iris: 0x6b4a2b,
  };

  // Cataract stages for the lens, clear to end stage (brunescent): sRGB colour and opacity.
  const CATARACT_STAGES = [
    { name: 'Clear',           color: 0xeef6ff, opacity: 0.25 },
    { name: 'Yellowish',       color: 0xf5eaa8, opacity: 0.4 },
    { name: 'Yellow',          color: 0xf2d64b, opacity: 0.5 },
    { name: 'Dark yellow',     color: 0xd9a91c, opacity: 0.62 },
    { name: 'Brownish yellow', color: 0xa8741e, opacity: 0.78 },
    { name: 'End stage',       color: 0x5a3414, opacity: 0.93 },
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
  function retinaHit(origin, dir) {
    const oc = origin.clone().sub(new THREE.Vector3(0, L.cS, 0));
    const b = oc.dot(dir);
    const c = oc.lengthSq() - L.retinaR * L.retinaR;
    const t = -b + Math.sqrt(Math.max(0, b * b - c));
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

  function meridianRays(thetaDeg, k, cornea, hex) {
    const material = rayMaterial(hex);
    const focalDistance = L.depthScale * (N_CORNEA / (N_CORNEA - 1)) / k;
    const focus = new THREE.Vector3(0, cornea.offset - focalDistance, 0);
    const objects = [];
    for (const h of [DIM.rayHeight, -DIM.rayHeight]) {
      const hit = anteriorPoint(h, thetaDeg, cornea);
      const start = new THREE.Vector3(hit.x, cornea.offset + DIM.rayStartInFront, hit.z);
      const dir = focus.clone().sub(hit).normalize();
      const onRetina = retinaHit(hit, dir);
      objects.push(tube(start, hit, DIM.rayRadius, material));
      objects.push(tube(hit, onRetina, DIM.rayRadius, material));
      // Beyond the retina: dotted, out to the focal point if it lies behind the retina,
      // otherwise a short stub showing the ray carrying on.
      const toFocus = focus.clone().sub(onRetina).dot(dir);
      const dottedEnd = onRetina.clone().addScaledVector(dir, toFocus > 0 ? toFocus : DIM.rayStubBeyondRetina);
      objects.push(dottedLine(onRetina, dottedEnd, material));
    }
    objects.push(focusDot(focus, hex));
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

  // Lens: fixed in place. It is seated so its front surface touches the back of the iris at the
  // default pupil margin, so it bulges slightly into the pupil.
  const LENS = (() => {
    const irisBack = L.refApexY - DIM.irisDepth - DIM.irisThickness;
    const apex = irisBack + sphereSag(DIM.lensAnteriorR, DIM.pupilRadius);
    const rEq = DIM.lensDiameter / 2;
    const thickness = sphereSag(DIM.lensAnteriorR, rEq) + sphereSag(DIM.lensPosteriorR, rEq);
    return { irisBack, rEq, cA: apex - DIM.lensAnteriorR, cB: apex - thickness + DIM.lensPosteriorR };
  })();
  const lensFrontY = (r) =>
    r < LENS.rEq ? LENS.cA + Math.sqrt(DIM.lensAnteriorR ** 2 - r * r) : -Infinity;

  // Iris: an annulus from the pupil out to the cornea's diameter. It is flat, except that a pupil
  // smaller than the default makes its inner part rest on the lens, curving slightly forward.
  // Each face/edge segment repeats its end points, so the lathe keeps hard edges at the corners.
  function irisGeometry(pupilRadius) {
    const steps = 24;
    const back = (r) => Math.max(LENS.irisBack, lensFrontY(r));
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
    const mesh = eye.userData.iris;
    mesh.geometry.dispose();
    mesh.geometry = irisGeometry(diameter / 2);
  }

  // Biconvex lens: two spherical caps meeting at a sharp equator.
  function lens() {
    const profile = [
      ...arc(LENS.cA, DIM.lensAnteriorR, 0, Math.asin(LENS.rEq / DIM.lensAnteriorR), 32),
      ...arc(LENS.cB, DIM.lensPosteriorR, Math.PI - Math.asin(LENS.rEq / DIM.lensPosteriorR), Math.PI, 32),
    ];
    // Translucent and closed: draw the far side first, then the near side, so its own faces
    // never sort over each other. Both before the translucent cornea (renderOrder 2).
    const geometry = new THREE.LatheGeometry(profile, 96);
    const group = new THREE.Group();
    [THREE.BackSide, THREE.FrontSide].forEach((side, i) => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
        transparent: true, shininess: 80, specular: 0xffffff, side, depthWrite: false,
      }));
      mesh.renderOrder = 1 + i * 0.5;
      group.add(mesh);
    });
    group.userData.kind = 'lens';
    return group;
  }

  // Colour the lens for a cataract stage (index into CATARACT_STAGES).
  function setCataract(eye, stage) {
    const { color, opacity } = CATARACT_STAGES[stage];
    for (const { material } of eye.userData.lens.children) {
      material.color.set(color).convertSRGBToLinear();
      material.opacity = opacity;
    }
  }

  // True power at which a meridian's rays focus exactly on the retina's posterior pole, given
  // the other meridian's power. The other meridian matters because the apex sits wherever the
  // most curved meridian puts it.
  function retinaFocusPower(otherPower, exaggeration = 1) {
    const c = L.depthScale * (N_CORNEA / (N_CORNEA - 1)); // focal distance = c / k
    const poleY = L.cS - L.retinaR;
    const halfR2 = (L.limbusR * L.limbusR) / 2;
    const kOther = drawnCurvature(otherPower, exaggeration);
    // Case 1: this meridian is the flatter one, so the apex is set by the other meridian.
    let k = c / (L.limbusY + kOther * halfR2 - poleY);
    if (k > kOther) {
      // Case 2: this meridian sets the apex itself: halfR2·k² + (limbusY − poleY)·k − c = 0.
      const b = L.limbusY - poleY;
      k = (-b + Math.sqrt(b * b + 4 * halfR2 * c)) / (2 * halfR2);
    }
    const drawnPower = k * 1000 * (N_CORNEA - 1);
    return DIM.referencePower + (drawnPower - DIM.referencePower) / exaggeration;
  }

  // Rebuild the cornea, its two principal-meridian lines and their light rays.
  function updateCornea(eye, params) {
    const cornea = corneaParams(params);
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
    group.add(...tag('rays', [
      ...meridianRays(cornea.meridian1, cornea.k1, cornea, COLORS.rays1),
      ...meridianRays(cornea.meridian2, cornea.k2, cornea, COLORS.rays2),
    ]));
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

    // Polar angles (from +y, about the globe centre) of the limbus points on the sclera.
    const aScleraOuter = Math.atan2(L.limbusR, L.limbusY - L.cS);
    const aScleraInner = Math.atan2(L.inner.r, L.inner.y - L.cS);

    // --- Sclera: half shell (lathe phi π..2π keeps the x < 0 half), outer and inner surfaces.
    const scleraMat = new THREE.MeshStandardMaterial({ color: COLORS.sclera, roughness: 0.6, side: THREE.DoubleSide });
    const outerProfile = arc(L.cS, DIM.scleraOuterR, aScleraOuter, Math.PI, 96);
    const innerProfile = arc(L.cS, L.scleraInnerR, aScleraInner, Math.PI, 96);
    group.add(new THREE.Mesh(new THREE.LatheGeometry(outerProfile, 64, Math.PI, Math.PI), scleraMat));
    group.add(new THREE.Mesh(new THREE.LatheGeometry(innerProfile, 64, Math.PI, Math.PI), scleraMat));

    // --- Cut face: the C-shaped meridional section of the shell, in the lathe's phi = 0 / π plane.
    const outerFull = arc(L.cS, DIM.scleraOuterR, aScleraOuter, 2 * Math.PI - aScleraOuter, 192);
    const innerFull = arc(L.cS, L.scleraInnerR, aScleraInner, 2 * Math.PI - aScleraInner, 192);
    const shape = new THREE.Shape([...outerFull, ...innerFull.reverse()]);
    // Shape lies in the XY plane; turn it into the lathe's x = 0 plane.
    group.add(new THREE.Mesh(
      new THREE.ShapeGeometry(shape, 1).rotateY(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: COLORS.scleraCut, roughness: 0.8, side: THREE.DoubleSide })
    ));

    // --- Retina: thin layer lining the inner sclera from the ora serrata back, same half as the sclera.
    const retinaR = L.scleraInnerR - DIM.retinaThickness;
    const aOra = THREE.MathUtils.degToRad(DIM.oraSerrataAngleDeg);
    const retinaMat = new THREE.MeshStandardMaterial({ color: COLORS.retina, roughness: 0.7, side: THREE.DoubleSide });
    group.add(new THREE.Mesh(
      new THREE.LatheGeometry(arc(L.cS, retinaR, aOra, Math.PI, 96), 64, Math.PI, Math.PI), retinaMat));
    // Its edge on the cut face, so the layer reads in section.
    const retinaShape = new THREE.Shape([
      ...arc(L.cS, L.scleraInnerR, aOra, 2 * Math.PI - aOra, 192),
      ...arc(L.cS, retinaR, aOra, 2 * Math.PI - aOra, 192).reverse(),
    ]);
    const retinaCutMat = retinaMat.clone();
    // Cut face 20% darker than the retina surface, measured on screen (output is sRGB-encoded).
    retinaCutMat.color.convertLinearToSRGB().multiplyScalar(0.8).convertSRGBToLinear();
    group.add(new THREE.Mesh(new THREE.ShapeGeometry(retinaShape, 1).rotateY(Math.PI / 2), retinaCutMat));

    group.userData.iris = iris();
    group.userData.lens = lens();
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

  return { build, updateCornea, setVisibility, setPupil, setCataract, retinaFocusPower, DIM, COLORS, CATARACT_STAGES };
})();
