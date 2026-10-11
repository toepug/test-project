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
    exaggerate: $('input-exaggerate'),
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

  function updateCornea() {
    const power1 = parseFloat(inputs.power1.value);
    const power2 = parseFloat(inputs.power2.value);
    const axis = parseFloat(inputs.axis.value);
    const exaggeration = inputs.exaggerate.checked ? EyeModel.DIM.curvatureExaggeration : 1;
    const c = EyeModel.updateCornea(eye, { power1, power2, axis, exaggeration });

    $('out-curvature-1').textContent = `${power1.toFixed(2)} D`;
    $('out-curvature-2').textContent = `${power2.toFixed(2)} D`;
    $('out-axis').textContent = `${displayAxis(axis)}°`;

    const cyl = -Math.abs(power1 - power2);
    const cylAxis = power1 <= power2 ? c.meridian1 : c.meridian2;
    $('ro-cyl').textContent = cyl === 0 ? '0.00 D' : `${cyl.toFixed(2)} D @ ${displayAxis(cylAxis)}°`;
    $('ro-type').textContent = astigmatismType(cylAxis, cyl);
    placeRetinaTick('curvature-1', EyeModel.retinaFocusPower(power2, exaggeration));
    placeRetinaTick('curvature-2', EyeModel.retinaFocusPower(power1, exaggeration));

    $('ro-curvature-1').textContent = `${power1.toFixed(2)} D @ ${displayAxis(c.meridian1)}°`;
    $('ro-curvature-2').textContent = `${power2.toFixed(2)} D @ ${displayAxis(c.meridian2)}°`;
  }

  for (const el of Object.values(inputs)) el.addEventListener('input', updateCornea);
  updateCornea();

  // Show/hide toggles for the light rays and curvature lines.
  for (const btn of document.querySelectorAll('[data-show]')) {
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      EyeModel.setVisibility(eye, { [btn.dataset.show]: on });
    });
  }

  for (const btn of document.querySelectorAll('[data-view]')) {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  }
  new ResizeObserver(resize).observe(host);

  setView('iso');
  resize();
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
})();
