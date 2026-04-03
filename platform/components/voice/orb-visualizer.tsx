"use client"

import { useEffect, useRef } from "react"

export type OrbState = "idle" | "listening" | "speaking"

const VERTEX_SHADER = `
attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_level;
uniform vec3 u_color;
uniform vec3 u_color2;

float noise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p);
  f = f*f*(3.0-2.0*f);
  float n = i.x + i.y*57.0 + 113.0*i.z;
  float a = fract(sin(n)*43758.5453);
  float b = fract(sin(n+1.0)*43758.5453);
  float c = fract(sin(n+57.0)*43758.5453);
  float d = fract(sin(n+58.0)*43758.5453);
  float e = fract(sin(n+113.0)*43758.5453);
  float f1 = fract(sin(n+114.0)*43758.5453);
  float g = fract(sin(n+170.0)*43758.5453);
  float h = fract(sin(n+171.0)*43758.5453);
  return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),
             mix(mix(e,f1,f.x),mix(g,h,f.x),f.y),f.z);
}

float fbm(vec3 p){
  float v=0.0, a=0.5;
  for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.0; a*=0.5; }
  return v;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - u_res*0.5) / min(u_res.x, u_res.y);
  float dist = length(uv);

  float baseR = 0.28;
  float deform = u_level * 0.12;
  float n = fbm(vec3(uv*3.0 + u_time*0.3, u_time*0.2)) * deform;
  float sphere = smoothstep(baseR + n + 0.02, baseR + n - 0.02, dist);

  vec3 col = mix(u_color, u_color2, fbm(vec3(uv*2.0, u_time*0.15)));
  float fresnel = pow(1.0 - smoothstep(0.0, baseR+n, dist * 0.85), 2.0);
  col += fresnel * 0.4;

  float glow = exp(-dist*dist*8.0) * (0.08 + u_level * 0.15);
  vec3 glowCol = mix(u_color, u_color2, 0.5) * glow;

  float pulse = 0.5 + 0.5*sin(u_time*2.0 + dist*10.0);
  float ring = smoothstep(0.005, 0.0, abs(dist - baseR - n - 0.03)) * (0.3 + u_level*0.5) * pulse;

  vec3 final = col * sphere + glowCol + mix(u_color,u_color2,0.5) * ring;
  float alpha = max(sphere * 0.95, max(glow * 2.0, ring));
  gl_FragColor = vec4(final, alpha);
}
`

export type OrbVisualizerProps = {
  state: OrbState
  audioLevel: number
  className?: string
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  src: string
): WebGLShader | null {
  const s = gl.createShader(type)
  if (!s) return null
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s))
    gl.deleteShader(s)
    return null
  }
  return s
}

export function OrbVisualizer({ state, audioLevel, className }: OrbVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioLevelRef = useRef(audioLevel)
  const stateRef = useRef(state)
  const vizLevelRef = useRef(0)
  const rafRef = useRef<number>(0)

  audioLevelRef.current = audioLevel
  stateRef.current = state

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    })
    if (!gl) {
      console.warn("WebGL not available")
      return
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    if (!vs || !fs) return

    const prog = gl.createProgram()
    if (!prog) {
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      return
    }
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog))
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      return
    }
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    )
    const aPos = gl.getAttribLocation(prog, "a_pos")
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, "u_res")
    const uTime = gl.getUniformLocation(prog, "u_time")
    const uLevel = gl.getUniformLocation(prog, "u_level")
    const uColor = gl.getUniformLocation(prog, "u_color")
    const uColor2 = gl.getUniformLocation(prog, "u_color2")

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const setSize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = Math.max(1, Math.floor(rect.width * dpr))
      const h = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    setSize()
    const ro = new ResizeObserver(() => setSize())
    ro.observe(canvas)

    const draw = () => {
      vizLevelRef.current +=
        (audioLevelRef.current - vizLevelRef.current) * 0.12

      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, performance.now() / 1000)
      gl.uniform1f(uLevel, vizLevelRef.current)

      const s = stateRef.current
      if (s === "speaking") {
        gl.uniform3f(uColor, 0.39, 0.4, 0.95)
        gl.uniform3f(uColor2, 0.55, 0.36, 0.96)
      } else if (s === "listening") {
        gl.uniform3f(uColor, 0.02, 0.71, 0.83)
        gl.uniform3f(uColor2, 0.39, 0.4, 0.95)
      } else {
        gl.uniform3f(uColor, 0.25, 0.28, 0.45)
        gl.uniform3f(uColor2, 0.2, 0.22, 0.38)
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      gl.useProgram(null)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "h-full w-full rounded-full"}
      aria-hidden
    />
  )
}
