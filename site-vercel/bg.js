(function(){
  var canvas=document.getElementById('bg-canvas');
  if(!canvas)return;
  var ctx=canvas.getContext('2d');
  var raw=canvas.dataset.accent||'124,58,237';
  var rgb=raw.split(',').map(Number);
  var r=rgb[0],g=rgb[1],b=rgb[2];
  var W,H,particles,mouse={x:-9999,y:-9999};
  var COUNT=Math.min(85,Math.floor(window.innerWidth/16));
  var LINK=155,MOUSE=95;
  function Particle(){this.reset(true)}
  Particle.prototype.reset=function(init){
    this.x=Math.random()*W;this.y=init?Math.random()*H:-10;
    this.vx=(Math.random()-.5)*.25;this.vy=(Math.random()*.22+.06)*(Math.random()>.5?1:-1);
    this.radius=1+Math.random()*1.6;this.life=0;this.maxLife=200+Math.random()*300;
  };
  Particle.prototype.update=function(){
    var dx=this.x-mouse.x,dy=this.y-mouse.y,d=Math.sqrt(dx*dx+dy*dy);
    if(d<MOUSE){var f=(MOUSE-d)/MOUSE*.35;this.vx+=dx/d*f;this.vy+=dy/d*f;}
    this.vx*=.996;this.vy*=.996;this.x+=this.vx;this.y+=this.vy;this.life++;
    if(this.x<-10)this.x=W+10;if(this.x>W+10)this.x=-10;
    if(this.y<-10)this.y=H+10;if(this.y>H+10)this.y=-10;
  };
  Particle.prototype.draw=function(){
    var fade=Math.min(this.life/40,(this.maxLife-this.life)/40,1);
    ctx.beginPath();ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
    ctx.fillStyle='rgba('+r+','+g+','+b+','+(0.55*fade)+')';ctx.fill();
  };
  function init(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;
    particles=Array.from({length:COUNT},function(){return new Particle();});}
  var raf;
  function loop(){
    ctx.clearRect(0,0,W,H);
    for(var i=0;i<particles.length;i++)for(var j=i+1;j<particles.length;j++){
      var dx=particles[i].x-particles[j].x,dy=particles[i].y-particles[j].y;
      var d=Math.sqrt(dx*dx+dy*dy);
      if(d<LINK){var a=(1-d/LINK)*.11;ctx.beginPath();ctx.moveTo(particles[i].x,particles[i].y);
        ctx.lineTo(particles[j].x,particles[j].y);ctx.strokeStyle='rgba('+r+','+g+','+b+','+a+')';ctx.lineWidth=.75;ctx.stroke();}
    }
    particles.forEach(function(p){p.update();p.draw();});raf=requestAnimationFrame(loop);
  }
  window.addEventListener('resize',function(){cancelAnimationFrame(raf);init();loop();});
  window.addEventListener('mousemove',function(e){mouse.x=e.clientX;mouse.y=e.clientY;});
  window.addEventListener('mouseleave',function(){mouse.x=-9999;mouse.y=-9999;});
  init();loop();
})();
