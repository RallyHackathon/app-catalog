This fork of the app-catalog contains the apps changed for the RallyOn 2014 hackathon entry named "Portfolio Item Chart Navigator".

The demo demonstrated a page with two apps, both of which are modifications to existing apps.

The first is the Portfolio Hierarchy app, located at src/apps/portfoliohierarchy.
The second is the Portfolio Item Cumulative Flow Diagram app, located at src/apps/charts/rpm/cfd.

To create the same setup as the demo:
- Build those apps
- Create a custom page in ALM, with a 2 column configuration (left column smaller than right column)
- Add a Custom HTML app, and insert the contents of src/apps/portfoliohierarchy/deploy/App-uncompressed.html
- Add another Custom HTML app, and then insert the contents of src/apps/charts/rpm/cfd/App-uncompressed.html

Now you should see the Portfolio Item Hierarchy on the left, and the Chart app on the right (no chart displaying yet).
Click a Portfolio Item to see the associated chart on the right.


