import { useCallback, useEffect, useRef, useState } from 'react'

type Point = { x: number; y: number }
type Thing = Point & { id: number; r: number; speed?: number }
type Echo = { id: number; path: Point[]; age: number; color: string }
type Game = { player: Point; keys: Set<string>; obstacles: Thing[]; coins: Thing[]; echoes: Echo[]; path: Point[]; elapsed: number; spawn: number; coinSpawn: number; echoSpawn: number; lives: number; score: number; coinScore: number; state: 'ready'|'playing'|'paused'|'over'; last: number }

const W = 100, H = 56
const fresh = (): Game => ({ player: { x: 50, y: 46 }, keys: new Set(), obstacles: [], coins: [], echoes: [], path: [], elapsed: 0, spawn: 0, coinSpawn: 0, echoSpawn: 0, lives: 3, score: 0, coinScore: 0, state: 'ready', last: 0 })
const clamp = (n:number, lo:number, hi:number) => Math.max(lo, Math.min(hi, n))
const dist = (a:Point,b:Point) => Math.hypot(a.x-b.x,a.y-b.y)

export default function App() {
  const game = useRef<Game>(fresh())
  const audio = useRef<AudioContext | null>(null)
  const [frame, setFrame] = useState(0)
  const [view, setView] = useState<'game'|'help'>('game')
  const [high, setHigh] = useState(() => Number(localStorage.getItem('echo-runner-high') || 0))
  const render = () => setFrame(v => v + 1)
  const sound = useCallback((tone:number, length=.07, type:OscillatorType='sine') => {
    try { const c = audio.current ?? new AudioContext(); audio.current = c; const o=c.createOscillator(), g=c.createGain(); o.type=type; o.frequency.value=tone; g.gain.setValueAtTime(.045,c.currentTime); g.gain.exponentialRampToValueAtTime(.001,c.currentTime+length); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime+length) } catch { /* audio is optional */ }
  }, [])
  const begin = useCallback(() => { const g=game.current; if(g.state==='over'||g.state==='ready') { game.current=fresh(); game.current.state='playing' } else g.state='playing'; sound(330,.05); render() }, [sound])
  const lose = useCallback(() => { const g=game.current; if(g.path.length>8) g.echoes.push({ id:Date.now(), path:[...g.path], age:0, color:['#9d7bff','#ff6c9e','#57d8ff'][g.echoes.length%3] }); g.lives--; sound(100,.22,'sawtooth'); if(g.lives<=0) { g.state='over'; if(g.score>high) { localStorage.setItem('echo-runner-high', String(g.score)); setHigh(g.score) } } else { g.player={x:50,y:46}; g.path=[]; g.obstacles=[]; g.coins=[]; g.elapsed=0; g.spawn=0; g.coinSpawn=0; g.echoSpawn=0 } render() }, [high,sound])
  useEffect(() => {
    const down=(e:KeyboardEvent) => { const key=e.key.toLowerCase(); if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' '].includes(key)) e.preventDefault(); if(key===' ') { const g=game.current; if(g.state==='playing') {g.state='paused'; render()} else begin() } else { game.current.keys.add(key); if(game.current.state==='ready') begin() } }
    const up=(e:KeyboardEvent) => game.current.keys.delete(e.key.toLowerCase())
    window.addEventListener('keydown',down); window.addEventListener('keyup',up); return ()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up)}
  },[begin])
  useEffect(() => {
    let id=0
    const loop=(now:number) => { const g=game.current; const dt=Math.min(.05,(now-g.last)/1000||0); g.last=now
      if(g.state==='playing') {
        const speed=21; let dx=0,dy=0; const k=g.keys
        if(k.has('a')||k.has('arrowleft'))dx--; if(k.has('d')||k.has('arrowright'))dx++; if(k.has('w')||k.has('arrowup'))dy--; if(k.has('s')||k.has('arrowdown'))dy++
        if(dx||dy){ const n=Math.hypot(dx,dy); g.player.x=clamp(g.player.x+dx/n*speed*dt,3,97); g.player.y=clamp(g.player.y+dy/n*speed*dt,5,53) }
        g.elapsed+=dt; g.score=Math.floor(g.elapsed*10)+g.coinScore; const level=1+Math.floor(g.elapsed/18)
        g.path.push({...g.player}); if(g.path.length>850)g.path.shift()
        g.spawn-=dt; g.coinSpawn-=dt; g.echoSpawn-=dt
        if(g.spawn<=0){ g.spawn=Math.max(.38,1.15-level*.07); g.obstacles.push({id:Math.random(),x:5+Math.random()*90,y:-4,r:2.1,speed:12+level*2+Math.random()*5}) }
        if(g.coinSpawn<=0){ g.coinSpawn=.9+Math.random()*1.2; g.coins.push({id:Math.random(),x:5+Math.random()*90,y:-3,r:1.25,speed:10+level}) }
        g.obstacles.forEach(o=>o.y+=(o.speed||10)*dt); g.coins.forEach(c=>c.y+=(c.speed||10)*dt)
        g.obstacles=g.obstacles.filter(o=>o.y<62); g.coins=g.coins.filter(c=>c.y<62)
        g.echoes.forEach(e=>e.age+=dt*10)
        // Add dormant echoes as survival climbs; their path is a safe short patrol until a failure supplies a real run.
        if(g.echoSpawn<=0 && g.elapsed>20 && g.echoes.length<Math.floor(g.elapsed/20)+1){g.echoSpawn=20; const p=Array.from({length:120},(_,i)=>({x:50+Math.sin(i/13)*16,y:46-Math.sin(i/9)*7}));g.echoes.push({id:Date.now(),path:p,age:0,color:'#b26dff'})}
        if(g.obstacles.some(o=>dist(o,g.player)<o.r+1.5) || g.echoes.some(e=>e.path.length && dist(e.path[Math.floor(e.age)%e.path.length],g.player)<2.5)) lose()
        g.coins=g.coins.filter(c=>{if(dist(c,g.player)<c.r+1.4){g.coinScore+=25; g.score+=25; sound(680,.05,'triangle'); return false}return true})
        if(Math.floor(now/60)%2===0) render()
      }
      id=requestAnimationFrame(loop)
    }; id=requestAnimationFrame(loop); return()=>cancelAnimationFrame(id)
  },[lose,sound])
  const g=game.current; void frame
  const press=(key:string,on:boolean)=>{if(on){g.keys.add(key);if(g.state==='ready')begin()}else g.keys.delete(key)}
  if(view==='help') return <main className="shell help"><nav><button className="brand" onClick={()=>setView('game')}>◉ ECHO RUNNER</button><button onClick={()=>setView('game')}>← Back to game</button></nav><section><p className="eyebrow">FIELD GUIDE / 01</p><h1>RUN FROM<br/><i>YOUR PAST.</i></h1><div className="help-grid"><article><b>MOVE</b><span>Use WASD or the arrow keys. On touch screens, hold the directional pad.</span></article><article><b>COLLECT</b><span>Grab gold signal coins for bonus points while dodging red static blocks.</span></article><article><b>REPEAT</b><span>Each lost life records your route. That run returns as an echo—avoid it next time.</span></article><article><b>SURVIVE</b><span>The world accelerates and more echoes arrive over time. You have three lives per run.</span></article></div></section></main>
  return <main className="shell"><nav><button className="brand" onClick={()=>setView('game')}>◉ ECHO RUNNER</button><div><button onClick={()=>setView('help')}>How to play</button><button onClick={()=>{g.state=g.state==='playing'?'paused':'playing';render()}}>{g.state==='playing'?'Pause':'Resume'}</button></div></nav><header><div><p className="eyebrow">ENDLESS SIGNAL / LVL {1+Math.floor(g.elapsed/18)}</p><h1>DON'T FOLLOW<br/><i>YOURSELF.</i></h1></div><div className="stats"><span>SCORE <b>{String(g.score).padStart(5,'0')}</b></span><span>BEST <b>{String(high).padStart(5,'0')}</b></span><span className="lives">{[0,1,2].map(n=><em key={n} className={n<g.lives?'live':''}>◆</em>)}</span></div></header><section className="arena" aria-label="Echo Runner game area">
    <div className="grid" /> <div className="scan" />
    {g.coins.map(c=><div className="coin" key={c.id} style={{left:`${c.x}%`,top:`${c.y}%`}}>+</div>)}
    {g.obstacles.map(o=><div className="obstacle" key={o.id} style={{left:`${o.x}%`,top:`${o.y}%`}} />)}
    {g.echoes.map(e=>{const p=e.path[Math.floor(e.age)%e.path.length];return <div className="echo" key={e.id} style={{left:`${p.x}%`,top:`${p.y}%`,borderColor:e.color,color:e.color}}><span /></div>})}
    <div className="runner" style={{left:`${g.player.x}%`,top:`${g.player.y}%`}}><span /></div>
    {g.state!=='playing'&&<div className="overlay"><p className="eyebrow">{g.state==='over'?'TRANSMISSION LOST':g.state==='paused'?'SIGNAL PAUSED':'ECHO RUNNER'}</p><h2>{g.state==='over'?'RUN ENDED':g.state==='paused'?'CATCH YOUR BREATH':'OUTRUN THE ECHO.'}</h2><p>{g.state==='over'?`Final score: ${g.score}`:'Every mistake becomes a moving memory.'}</p><button className="primary" onClick={begin}>{g.state==='over'?'Run again':'Start running'} <b>→</b></button><small>{g.state==='ready'?'WASD / ARROW KEYS TO MOVE':'Space toggles pause'}</small></div>}
  </section><div className="mobile-controls">{[['↑','w'],['←','a'],['↓','s'],['→','d']].map(([label,key])=><button key={key} onPointerDown={()=>press(key,true)} onPointerUp={()=>press(key,false)} onPointerLeave={()=>press(key,false)}>{label}</button>)}</div><footer><span>KEEP MOVING. KEEP CLEAR.</span><span>YOUR TRAIL IS NEVER GONE.</span></footer></main>
}
