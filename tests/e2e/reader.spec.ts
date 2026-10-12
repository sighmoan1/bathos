import {test,expect} from '@playwright/test';
test('shared theme retains readable recipes and keyboard controls',async({page})=>{
 page.on('pageerror', e => console.log('Browser error:',e.message));
 page.on('requestfailed',r=>console.log('Failed request:',r.url(),r.failure()?.errorText));
 await page.goto('/');
 const heading=page.getByRole('heading',{level:2}).first();
 await expect(heading).toBeVisible();
 const initialTitle=await heading.textContent();
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(heading).not.toHaveText(initialTitle!);
 await page.getByRole('button',{name:'Previous',exact:true}).click();
 await expect(heading).toHaveText(initialTitle!);
 await page.getByRole('button',{name:'Read Article',exact:true}).click();
 await expect(page.getByRole('button',{name:/close|back/i}).first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bathos-color-accent-light').trim())).toBe('#b599ed');
});
