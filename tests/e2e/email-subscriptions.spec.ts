import {test,expect} from '@playwright/test'

test('email signup stays hidden while delivery is unavailable',async({page})=>{
 await page.route('**/api/subscriptions/status',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({enabled:false})}))
 await page.goto('/subscribe/')
 await expect(page.getByRole('heading',{name:'By RSS',exact:true})).toBeVisible()
 await expect(page.getByRole('heading',{name:'By email',exact:true})).toHaveCount(0)
 await expect(page.getByRole('textbox',{name:'Email address'})).toHaveCount(0)
})

test('phone email form validates input, submits only verified requests, resets challenges and shows recoverable errors',async({page})=>{
 const errors:string[]=[],requests:unknown[]=[]
 page.on('pageerror',error=>errors.push(error.message))
 let status=202
 await page.route('**/api/subscriptions/status',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({enabled:true,siteKey:'1x00000000000000000000AA'})}))
 await page.route('**/api/subscriptions',route=>{
  requests.push(route.request().postDataJSON())
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(status===202?{ok:true,message:'Check your inbox to confirm.'}:{error:'Please try again.'})})
 })
 // Mock only the external challenge widget; real server-side verification is covered by Worker tests.
 await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*',route=>route.fulfill({contentType:'application/javascript',body:`
 let options, count=0; window.testChallengeResets=0;
 window.turnstile={render(container,config){options=config;window.testChallengeOptions={sitekey:config.sitekey,action:config.action,size:config.size};container.style.width='150px';container.style.height='140px';const button=document.createElement('button');button.type='button';button.textContent='Complete verification';button.onclick=()=>options.callback('verified-token-'+(++count));container.append(button);return 'widget-1';},reset(){window.testChallengeResets++;},remove(){}};
 window.expireTestChallenge=()=>options['expired-callback']();
 `}))
 for(const width of [320,390]){
  await page.setViewportSize({width,height:812})
  await page.goto('/subscribe/')
  await expect(page.getByRole('heading',{name:'By email',exact:true})).toBeVisible()
  const submit=page.getByRole('button',{name:'Subscribe by email',exact:true})
  await expect(submit).toBeDisabled()
  const input=page.getByRole('textbox',{name:'Email address',exact:true})
  await input.fill('invalid')
  await page.getByRole('button',{name:'Complete verification'}).click()
  const before=requests.length
  await submit.click()
  expect(requests).toHaveLength(before)
  await input.fill('reader@example.test')
  await submit.click()
  await expect(page.getByRole('status')).toContainText('Check your inbox')
  expect(requests.at(-1)).toMatchObject({email:'reader@example.test',token:'verified-token-1'})
  await expect(input).toHaveValue('')
  await expect(submit).toBeDisabled()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width)
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('reader@example.test')
  await input.fill('reader@example.test')
  await page.getByRole('button',{name:'Complete verification'}).click()
  await page.evaluate(()=>{const expire=(window as Window & {expireTestChallenge?:()=>void}).expireTestChallenge;if(!expire)throw Error('Challenge test fixture is missing');expire()})
  await expect(submit).toBeDisabled()
  await page.getByRole('button',{name:'Complete verification'}).click()
  status=403
  await submit.click()
  await expect(page.getByRole('region',{name:'By email'}).getByRole('alert')).toContainText('Please try again')
  await expect(input).toHaveValue('reader@example.test')
  await expect(submit).toBeDisabled()
  status=202
  await page.getByRole('button',{name:'Complete verification'}).click()
  await submit.click()
  await expect(page.getByRole('status')).toContainText('Check your inbox')
  const options=await page.evaluate(()=>(window as Window & {testChallengeOptions?:unknown}).testChallengeOptions)
  expect(options).toMatchObject({action:'subscribe',size:'compact'})
  expect(await page.evaluate(()=>(window as Window & {testChallengeResets?:number}).testChallengeResets)).toBe(3)
 }
 expect(errors).toEqual([])
})
