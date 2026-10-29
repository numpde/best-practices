const tileInteractions={
 flip(button,{front,back}){
 let turns=0;
 button.addEventListener('click',event=>{
  const bounds=button.getBoundingClientRect();
  turns+=event.clientX<bounds.x+bounds.width/2?-1:1;
  const flipped=Math.abs(turns%2)===1;
  button.style.setProperty('--turn',`${turns*180}deg`);
  button.setAttribute('aria-expanded',String(flipped));
  front.setAttribute('aria-hidden',String(flipped));
  back.setAttribute('aria-hidden',String(!flipped));
 });
 }
};
