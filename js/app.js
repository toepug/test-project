// Scene, camera and orbit controls for the rotatable eye model.
(() => {
  const host = document.getElementById('viewer');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setClearColor(0x0d1117);
  renderer.outputEncoding = THREE.sRGBEncoding;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 200;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(30, 40, 50);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-30, -10, -40);
  scene.add(fill);

  const eye = EyeModel.build();
  scene.add(eye);
  const center = eye.userData.center;
  const dist = eye.userData.radius * 5;

  // Preset camera directions (from the eye's centre). +Z is anterior; the cut face looks toward +X.
  const VIEWS = {
    iso:   new THREE.Vector3(1, 0.6, 1),
    front: new THREE.Vector3(0, 0, 1),
    side:  new THREE.Vector3(1, 0, 0),
    top:   new THREE.Vector3(0, 1, 0.0001),
  };

  function setView(name) {
    const dir = VIEWS[name].clone().normalize();
    camera.position.copy(center).addScaledVector(dir, dist);
    camera.up.set(0, 1, 0);
    controls.target.copy(center);
    controls.update();
  }

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ---------- Cornea controls ----------
  const $ = (id) => document.getElementById(id);
  const inputs = {
    power1: $('input-curvature-1'), power2: $('input-curvature-2'), axis: $('input-axis'),
    exaggerate: $('input-exaggerate'), axialLength: $('input-axial-length'),
    vergence: $('input-vergence'), accommodate: $('input-accommodate'),
  };
  $('exaggeration-factor').textContent = `(×${EyeModel.DIM.curvatureExaggeration})`;
  const displayAxis = (a) => (Math.round(a) % 180 === 0 ? 180 : Math.round(a) % 180);

  // ±30° rule on the minus-cylinder axis (the meridian of the lower power).
  function astigmatismType(axis, cyl) {
    if (cyl === 0) return 'None (spherical)';
    if (axis <= 30 || axis >= 150) return 'With-the-Rule';
    if (axis >= 60 && axis <= 120) return 'Against-the-Rule';
    return 'Oblique';
  }

  // Refractive state from where each meridian focuses ('front' | 'on' | 'behind'), for the label
  // in the top left.
  function refractiveState([f1, f2], equalCurvatures) {
    if (f1 === 'on' && f2 === 'on') return { title: 'Emmetropia / No prescription', subtitle: '' };
    const sides = [f1, f2];
    if (sides.includes('front') && sides.includes('behind')) return { title: 'Mixed Astigmatism', subtitle: '' };
    const myopic = sides.includes('front');
    const [title, word] = myopic ? ['Myopia / Nearsightedness', 'myopic'] : ['Hyperopia / Farsightedness', 'hyperopic'];
    const subtitle = sides.includes('on') ? `Simple ${word} astigmatism`
      : equalCurvatures ? `Simple ${myopic ? 'myopia' : 'hyperopia'}`
      : `Compound ${word} astigmatism`;
    return { title, subtitle };
  }

  function showRefractiveState(state) {
    $('state-label').hidden = false;
    $('state-title').textContent = state.title;
    $('state-subtitle').textContent = state.subtitle;
    $('state-subtitle').hidden = !state.subtitle;
  }

  // Put a slider's green tick under the value where its rays focus on the retina (hidden when
  // that value is off the slider). The thumb centre travels from half a thumb in to half a thumb
  // from the end, so the tick follows the same path.
  function placeRetinaTick(name, power) {
    const input = $(`input-${name}`), tick = $(`tick-${name}`);
    const f = (power - input.min) / (input.max - input.min);
    tick.hidden = !(f >= 0 && f <= 1);
    tick.style.left = `calc(${f} * (100% - var(--thumb)) + var(--thumb) / 2)`;
    tick.title = `Focuses on the retina at ${power.toFixed(2)} D`;
  }

  // Which ray sets the Light rays sub-menu shows (checkboxes, either or both).
  const rayModes = {};
  for (const box of document.querySelectorAll('[data-ray-mode]')) rayModes[box.dataset.rayMode] = box.checked;

  function updateCornea() {
    const power1 = parseFloat(inputs.power1.value);
    const power2 = parseFloat(inputs.power2.value);
    const axis = parseFloat(inputs.axis.value);
    const exaggeration = inputs.exaggerate.checked ? EyeModel.DIM.curvatureExaggeration : 1;
    const axialLength = parseFloat(inputs.axialLength.value);
    const vergence = parseFloat(inputs.vergence.value);
    const accommodate = inputs.accommodate.checked;
    const c = EyeModel.updateCornea(eye, { power1, power2, axis, exaggeration, axialLength, rayModes, vergence, accommodate });
    $('out-axial-length').textContent = `${axialLength.toFixed(1)} mm`;
    $('out-vergence').textContent = vergence ? `${vergence.toFixed(2)} D (${Math.round(100 / vergence)} cm)` : '0 D (distant)';
    const max = EyeModel.DIM.maxAccommodation;
    $('ro-accommodation').textContent = !accommodate ? 'Off'
      : c.accommodationNeeded > max ? `${max.toFixed(2)} D (at its limit)`
      : `${c.accommodation.toFixed(2)} of ${max.toFixed(2)} D`;
    const focusPower = EyeModel.retinaFocusPower(axialLength, exaggeration);
    placeRetinaTick('curvature-1', focusPower);
    placeRetinaTick('curvature-2', focusPower);

    $('out-curvature-1').textContent = `${power1.toFixed(2)} D`;
    $('out-curvature-2').textContent = `${power2.toFixed(2)} D`;
    $('out-axis').textContent = `${displayAxis(axis)}°`;

    const cyl = -Math.abs(power1 - power2);
    const cylAxis = power1 <= power2 ? c.meridian1 : c.meridian2;
    $('ro-cyl').textContent = cyl === 0 ? '0.00 D' : `${cyl.toFixed(2)} D @ ${displayAxis(cylAxis)}°`;
    $('ro-type').textContent = astigmatismType(cylAxis, cyl);

    $('ro-curvature-1').textContent = `${power1.toFixed(2)} D @ ${displayAxis(c.meridian1)}°`;
    $('ro-curvature-2').textContent = `${power2.toFixed(2)} D @ ${displayAxis(c.meridian2)}°`;

    showRefractiveState(refractiveState(c.focus, power1 === power2));
  }

  // Lock: moving either curvature slider moves the other by the same amount, keeping the
  // difference between them. The move is limited so neither slider runs past its end.
  // Registered before updateCornea so both values are set when the cornea is rebuilt.
  const lock = $('input-lock-curvatures');
  const previous = new Map([[inputs.power1, inputs.power1.value], [inputs.power2, inputs.power2.value]]);
  for (const [el, other] of [[inputs.power1, inputs.power2], [inputs.power2, inputs.power1]]) {
    el.addEventListener('input', () => {
      if (lock.checked) {
        const otherValue = parseFloat(other.value);
        const delta = Math.min(Math.max(el.value - previous.get(el), other.min - otherValue), other.max - otherValue);
        el.value = parseFloat(previous.get(el)) + delta;
        other.value = otherValue + delta;
      }
      for (const input of previous.keys()) previous.set(input, input.value);
    });
  }

  for (const el of Object.values(inputs)) el.addEventListener('input', updateCornea);
  updateCornea();

  // Reset both curvatures to the retina-focus power (snapped to the slider step).
  $('reset-curvatures').addEventListener('click', () => {
    const step = parseFloat(inputs.power1.step);
    const exaggeration = inputs.exaggerate.checked ? EyeModel.DIM.curvatureExaggeration : 1;
    const focusPower = EyeModel.retinaFocusPower(parseFloat(inputs.axialLength.value), exaggeration);
    const value = Math.min(Math.max(Math.round(focusPower / step) * step, inputs.power1.min), inputs.power1.max);
    for (const el of previous.keys()) {
      el.value = value;
      previous.set(el, el.value); // so a locked drag afterwards starts from here
    }
    updateCornea();
  });

  // Show/hide toggles. A control marked data-show-for="<name>" is shown only while that part is.
  for (const btn of document.querySelectorAll('[data-show]')) {
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      EyeModel.setVisibility(eye, { [btn.dataset.show]: on });
      for (const el of document.querySelectorAll(`[data-show-for="${btn.dataset.show}"]`)) el.hidden = !on;
      // The cataract rays depend on whether the iris and lens are shown.
      if (rayModes.cataract) updateCornea();
    });
  }

  // Light rays sub-menu.
  for (const box of document.querySelectorAll('[data-ray-mode]')) {
    box.addEventListener('change', () => {
      rayModes[box.dataset.rayMode] = box.checked;
      updateCornea();
    });
  }

  // Pupil size (diameter, mm).
  const pupil = $('input-pupil');
  function updatePupil() {
    const diameter = parseFloat(pupil.value);
    EyeModel.setPupil(eye, diameter);
    $('out-pupil').textContent = `${diameter.toFixed(1)} mm`;
    if (rayModes.cataract) updateCornea();
  }
  pupil.addEventListener('input', updatePupil);
  updatePupil();

  // Cataract stage of the lens.
  const cataract = $('input-cataract');
  function updateCataract() {
    const stage = parseInt(cataract.value, 10);
    EyeModel.setCataract(eye, stage);
    $('out-cataract').textContent = EyeModel.CATARACT_STAGES[stage].name;
    if (rayModes.cataract) updateCornea();
  }
  cataract.addEventListener('input', updateCataract);
  updateCataract();

  for (const btn of document.querySelectorAll('[data-view]')) {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  }
  new ResizeObserver(resize).observe(host);

  setView('iso');
  resize();
  renderer.setAnimationLoop(() => {
    controls.update();
    EyeModel.orderForCamera(eye, camera);
    renderer.render(scene, camera);
  });
})();
