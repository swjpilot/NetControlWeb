# Deployment Verification Checklist

## ✅ Deployment Complete - Please Verify

### Step 1: Clear Browser Cache
**Important:** The old version may be cached in your browser.

**Chrome/Edge:**
- Press `Ctrl+Shift+R` (Windows/Linux)
- Press `Cmd+Shift+R` (Mac)

**Firefox:**
- Press `Ctrl+Shift+Delete` and clear cache
- Or press `Ctrl+F5`

**Safari:**
- Press `Cmd+Option+E` to empty cache
- Then `Cmd+R` to reload

### Step 2: Access the Application
Visit one of these URLs:
- https://netcontrol-prod.eba-tu7jpbdw.us-east-1.elasticbeanstalk.com
- https://netcontrol.hamsunite.org

### Step 3: Log In
Use your existing credentials

### Step 4: Check Navigation Menu
Look at the left sidebar navigation menu.

**You should see:**
```
☐ Dashboard
☐ Net Sessions
☐ Net Schedules  ← NEW! This should be visible
☐ Operators
☐ QRZ Lookup
☐ FCC Database
☐ Reports
☐ User Management (if admin)
☐ Settings (if admin)
```

### Step 5: Test the Scheduling Page
1. Click on "Net Schedules"
2. You should see:
   - "New Schedule" button at the top
   - Empty state message (if no schedules yet)
   - "Upcoming Nets" sidebar on the right

### Step 6: Create a Test Schedule
1. Click "New Schedule"
2. Fill in the form:
   - Name: "Test Schedule"
   - Frequency: "146.520 MHz"
   - Mode: FM
   - Start Time: 19:00
   - Recurrence: Weekly
   - Days: Check any day
   - Start Date: Tomorrow
3. Click "Create Schedule"
4. Verify it appears in the list

### Step 7: Assign an Operator
1. Find your test schedule
2. Click the "+ Add Operator" dropdown
3. Select an operator
4. Verify the operator badge appears

### Step 8: Check Upcoming Nets
Look at the right sidebar - you should see your scheduled net listed with:
- Date
- Time
- Assigned operator

## Troubleshooting

### If "Net Schedules" menu is NOT visible:

1. **Hard refresh the page:**
   - Chrome/Edge: `Ctrl+Shift+R` or `Cmd+Shift+R`
   - Firefox: `Ctrl+F5`
   - Safari: `Cmd+Option+E` then `Cmd+R`

2. **Clear all browser data:**
   - Go to browser settings
   - Clear browsing data
   - Select "Cached images and files"
   - Clear data
   - Reload the page

3. **Try a different browser:**
   - Open in Chrome, Firefox, or Safari
   - Log in again
   - Check if menu appears

4. **Check browser console:**
   - Press F12 to open developer tools
   - Look for any errors in the Console tab
   - Take a screenshot if you see errors

5. **Verify deployment version:**
   - Open browser developer tools (F12)
   - Go to Network tab
   - Reload the page
   - Check the main.*.js file being loaded
   - It should be main.7d3e5e1d.js (new version)

### If you see errors:

**"React app not found"**
- This was fixed in the latest deployment
- Clear cache and hard refresh

**404 on /schedules**
- Clear cache and hard refresh
- Verify you're logged in

**Blank page**
- Check browser console for errors
- Clear cache and try again

**API errors**
- Check that you're logged in
- Verify your session hasn't expired

## Deployment Information

**Version:** 1.2.0 (app-260312_181735)  
**Deployed:** March 12, 2026 22:17 UTC  
**Status:** Ready / Green  
**Build Hash:** 7d3e5e1d  

## Need Help?

If you're still having issues after trying the troubleshooting steps:

1. Check the deployment logs:
   ```bash
   aws logs tail /aws/elasticbeanstalk/netcontrol-prod/var/log/nodejs/nodejs.log \
       --follow --profile thejohnweb --region us-east-1
   ```

2. Verify the environment status:
   ```bash
   aws elasticbeanstalk describe-environments \
       --profile thejohnweb \
       --region us-east-1 \
       --environment-names netcontrol-prod
   ```

3. Review the documentation:
   - Quick Start: `docs/SCHEDULING_QUICKSTART.md`
   - Full Docs: `docs/NET_SCHEDULING.md`
   - Deployment: `FINAL_DEPLOYMENT_SUMMARY.md`

## Success Confirmation

Once you can see and use the "Net Schedules" menu:

✅ Deployment is successful!  
✅ All features are working!  
✅ You can start creating schedules!  

Enjoy the new Net Scheduling System! 🎉
