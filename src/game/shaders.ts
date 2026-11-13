export const waterVertexShader = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying float vElevation;

float wave(vec2 p, float t) {
  float w1 = sin(p.x * 0.07 + t * 0.65) * cos(p.y * 0.055 + t * 0.48);
  float w2 = sin(p.x * 0.14 + p.y * 0.11 + t * 1.05) * 0.42;
  float w3 = sin(p.x * 0.028 + t * 0.32) * cos(p.y * 0.036 - t * 0.38) * 0.85;
  float w4 = sin((p.x + p.y) * 0.22 + t * 1.65) * 0.16;
  float w5 = sin(p.x * 0.45 - p.y * 0.3 + t * 2.4) * 0.06;
  return (w1 + w2 + w3 + w4 + w5) * uWaveHeight;
}

void main() {
  vUv = uv;
  vec3 pos = position;
  vec2 p = pos.xz;

  float e = wave(p, uTime);
  float eX = wave(p + vec2(0.35, 0.0), uTime);
  float eZ = wave(p + vec2(0.0, 0.35), uTime);

  vElevation = e;
  pos.y += e;

  vec3 tangent = normalize(vec3(0.35, eX - e, 0.0));
  vec3 bitangent = normalize(vec3(0.0, eZ - e, 0.35));
  vec3 objectNormal = normalize(cross(bitangent, tangent));

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;
  vNormalW = normalize(mat3(modelMatrix) * objectNormal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`

export const waterFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uFoamColor;
uniform vec3 uSunDirection;
uniform float uShoreZ;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying float vElevation;

void main() {
  vec3 normal = normalize(vNormalW);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vec3 sunDir = normalize(uSunDirection);

  float offshore = smoothstep(uShoreZ + 4.0, uShoreZ - 55.0, vWorldPos.z);
  float depthTone = clamp(offshore * 0.85 + vElevation * 0.18 + 0.1, 0.0, 1.0);
  vec3 waterColor = mix(uShallowColor, uDeepColor, depthTone);

  // wave shading from normals
  float ndl = max(dot(normal, sunDir), 0.0);
  waterColor *= 0.55 + 0.45 * ndl;
  waterColor += vec3(0.02, 0.08, 0.1) * (1.0 - ndl);

  float sss = pow(max(dot(viewDir, -sunDir + normal * 0.45), 0.0), 2.5) * 0.35;
  waterColor += vec3(0.04, 0.28, 0.24) * sss;

  vec3 halfDir = normalize(sunDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), 220.0);
  float wideSpec = pow(max(dot(normal, halfDir), 0.0), 24.0) * 0.25;
  vec3 sunColor = vec3(1.0, 0.93, 0.75);
  waterColor += sunColor * (spec * 1.8 + wideSpec);

  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.8);
  vec3 skyLow = vec3(0.35, 0.55, 0.72);
  vec3 skyHigh = vec3(0.55, 0.75, 0.92);
  float skyMix = clamp(reflect(-viewDir, normal).y * 0.5 + 0.5, 0.0, 1.0);
  vec3 skyReflect = mix(skyLow, skyHigh, skyMix);
  skyReflect += sunColor * pow(max(dot(reflect(-viewDir, normal), sunDir), 0.0), 10.0) * 0.55;
  waterColor = mix(waterColor, skyReflect, fresnel * 0.78);

  float crest = smoothstep(uWaveHeight * 0.45, uWaveHeight * 0.95, vElevation);
  crest *= 0.55 + 0.45 * sin(vWorldPos.x * 0.55 + vWorldPos.z * 0.4 + uTime * 1.2);

  float shore = 1.0 - smoothstep(uShoreZ - 2.0, uShoreZ - 14.0, vWorldPos.z);
  float shoreFoam = shore * (0.35 + 0.65 * sin(vWorldPos.x * 1.4 - uTime * 1.8 + vElevation * 4.0));
  shoreFoam *= smoothstep(0.0, 0.25, abs(vElevation) + 0.15);

  float foam = max(crest * 0.55, shoreFoam * 0.7);
  waterColor = mix(waterColor, uFoamColor, clamp(foam, 0.0, 0.85) * 0.9);

  float sparkle = sin(vWorldPos.x * 14.0 + uTime * 2.8) * sin(vWorldPos.z * 12.0 - uTime * 2.2);
  sparkle = pow(max(sparkle, 0.0), 10.0) * fresnel * 0.22;
  waterColor += sparkle;

  // underwater caustics (教程同款：随浪流动的焦散)
  vec2 cauUV = vWorldPos.xz * 0.08 + normal.xz * 0.35;
  float cau =
    sin(cauUV.x * 18.0 + uTime * 1.4) *
    sin(cauUV.y * 16.0 - uTime * 1.1);
  cau = pow(max(cau, 0.0), 2.2);
  float cau2 =
    sin((cauUV.x + cauUV.y) * 22.0 - uTime * 1.7) *
    sin((cauUV.x - cauUV.y) * 19.0 + uTime * 1.3);
  cau2 = pow(max(cau2, 0.0), 2.5);
  float shallow = 1.0 - depthTone;
  waterColor += vec3(0.35, 0.55, 0.45) * (cau * 0.18 + cau2 * 0.12) * shallow;

  // sun glitter path / 迎光水面阳光亮路
  vec3 sunFlat = normalize(vec3(sunDir.x, 0.001, sunDir.z));
  float path = abs(dot(normalize(vWorldPos.xz), sunFlat.xz));
  float glitterPath = pow(1.0 - path, 8.0) * pow(max(dot(normal, halfDir), 0.0), 6.0);
  glitterPath *= smoothstep(0.15, 0.55, sunDir.y);
  waterColor += sunColor * glitterPath * 0.55;

  float alpha = mix(0.88, 0.96, fresnel);
  alpha = mix(alpha, 0.98, foam * 0.5);

  gl_FragColor = vec4(waterColor, alpha);
}
`

export const skyVertexShader = /* glsl */ `
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w;
}
`

export const skyFragmentShader = /* glsl */ `
uniform vec3 uSunDirection;
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uWarmHorizon;
varying vec3 vWorldPosition;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.05;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vWorldPosition);
  float h = dir.y;
  vec3 sunDir = normalize(uSunDirection);

  float sunHeight = clamp(sunDir.y, 0.0, 1.0);
  vec3 horizon = mix(uWarmHorizon, uHorizon, smoothstep(0.05, 0.45, sunHeight));

  vec3 sky = mix(horizon, uMid, smoothstep(-0.05, 0.25, h));
  sky = mix(sky, uZenith, smoothstep(0.15, 0.75, h));

  float sunDot = max(dot(dir, sunDir), 0.0);
  float mie = pow(sunDot, 8.0) * 0.28;
  float mieTight = pow(sunDot, 64.0) * 0.55;
  float disk = smoothstep(0.9994, 0.99985, sunDot);
  sky += vec3(1.0, 0.82, 0.55) * mie;
  sky += vec3(1.0, 0.92, 0.75) * mieTight;
  sky += vec3(1.0, 0.98, 0.9) * disk * 3.2;

  float haze = exp(-max(h, 0.0) * 6.0) * 0.18;
  sky = mix(sky, horizon * 1.05, haze);

  vec2 cuv = dir.xz / max(dir.y + 0.12, 0.02);
  cuv += uTime * 0.008;
  float clouds = fbm(cuv * 1.35);
  clouds = smoothstep(0.48, 0.78, clouds);
  clouds *= smoothstep(0.02, 0.28, h) * smoothstep(0.85, 0.35, h);
  float cloudShade = 0.82 + 0.18 * noise(cuv * 3.0 + 10.0);
  vec3 cloudColor = vec3(0.96, 0.97, 0.99) * cloudShade;
  cloudColor = mix(cloudColor, vec3(1.0, 0.9, 0.75), mie * 0.35);
  sky = mix(sky, cloudColor, clouds * 0.78);

  gl_FragColor = vec4(sky, 1.0);
}
`
