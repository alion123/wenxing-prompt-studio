// Run with an authenticated isolated fixture (e.g. after testAdminDashboard).
export async function testServiceBackup({page,expect}){
 await page.getByRole('button',{name:'关闭账号窗口',exact:true}).click();
 await page.locator('.top-actions > button.model-button:not(.account-trigger)').click();
 const dialog=page.getByRole('dialog'),file=dialog.getByLabel('选择备份文件',{exact:true});
 const box=dialog.locator('.backup-file-box');await expect(box).toBeVisible();
 const border=await box.evaluate(e=>({width:getComputedStyle(e).borderTopWidth,style:getComputedStyle(e).borderTopStyle}));expect(parseFloat(border.width)).toBeGreaterThan(0);expect(border.style).not.toBe('none');
 await file.setInputFiles({name:'invalid-backup.json',mimeType:'application/json',buffer:Buffer.from('{}')});
 await expect(dialog.getByRole('alert')).toBeVisible();await expect(dialog.getByText('invalid-backup.json',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 return {boxedUpload:true,selectedFilenameVisible:true,invalidBackupRejected:true,mobileNoOverflow:true};
}
