(function(){var els=document.querySelectorAll('.reveal');if(!els.length)return;
var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target);}});},{threshold:.12});
els.forEach(function(el){io.observe(el);});})();
