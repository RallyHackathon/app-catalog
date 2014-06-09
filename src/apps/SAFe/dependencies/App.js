Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    launch: function() {
        //Filter for grid - show stories that have dependencies defined
        var myFilter = Ext.create('Rally.data.QueryFilter',
            {
                property: 'DependencyDescription',
                operator: '!=',
                value: ''
            });
        console.log("filter = ", myFilter);
        
        // if there is a timebox on the dashboard/page, make use of it
        this._timeboxScope = this.getContext().getTimeboxScope();
        console.log("timebox: ", this._timeboxScope);
        if( this._timeboxScope ) {
            console.log("Timebox query: ", this._timeboxScope.getQueryFilter());
            myFilter = this._timeboxScope.getQueryFilter();
        } 
        
        // Button to add a dependency
        this.add(Ext.create('Ext.Container', {
            items: [{
                xtype: 'rallybutton',
                text: 'Add Dependency',
                handler: function() {
                    console.log("butten clicked");
                    this._invokeStoryPicker();
                },
                scope: this
            }]
        }));
      
        this._loadDependencies(myFilter);
    },    
    
    _invokeStoryPicker: function() {
        var filter; /* = Ext.create('Rally.data.QueryFilter',
            {
                property: 'DependencyDescription',
                operator: '=',
                value: null
            });*/
            
        if( this._timeboxScope ) { //If we have a timebox, use it
            filter = this._timeboxScope.getQueryFilter();
        } 
        
        console.log("picker filter: ", filter.toString());
        Ext.create('Rally.ui.dialog.SolrArtifactChooserDialog', {
            artifactTypes: ['userstory'],
            autoShow: true,
            height: 500,
            title: 'Choose User Stories',
            storeConfig: { 
                filters: filter, 
                fetch: ["FormattedID", "Name", "DependencyDescription", "Release"]
            },
            columns: [{text: 'ID', dataIndex: 'FormattedID'}, 'Name', 'Release'],
            listeners: {
                artifactchosen: function(dbox, selectedRecord){
                    console.log( "selected story: ", selectedRecord);
                    // fill in dependency name info, then refresh the grid to
                    // include the this story
                    var text = "New Dependency";
                    selectedRecord.set('DependencyDescription', text);
                    selectedRecord.save();
                    this._store.reload();
                    this._updateGrid(this._store);
                },
                scope: this
            }
         });
    },
        
    _loadDependencies: function(query) {
        this._store = Ext.create("Rally.data.WsapiDataStore", {
            model: "UserStory",
            autoLoad: true,
            filters: query,
            remoteSort: false,
            listeners: {
                load: function(store, records, success) {
                   this._updateGrid(store);
                   console.log("loading");
                },
                update: function(store, rec, modified, opts) {
                    console.log("calling store update");
                    this._updateGrid(store);
                },
                scope: this
            },
            fetch: ["FormattedID", "Name", "Feature", "DependencyDescription", "RequestedFrom", "DateNeeded", "Supported"]
        });
    },
     _createGrid: function(myStore) {
        this._myGrid = Ext.create("Rally.ui.grid.Grid", {
            xtype: "rallygrid",
            title: "Story Dependency Grid",
            height: "98%",
            store: myStore,
            selType: "cellmodel",
            columnCfgs: [
                {
                     text: "Name",
                     dataIndex: "DependencyDescription",
                     flex: 2
                 },
                 {
                     text: "From Who",
                     dataIndex: "RequestedFrom"
                 },
                 {
                     text: "Needed By",
                     dataIndex: "DateNeeded"
                 },
                 {
                     text: "Supported",
                     dataIndex: "Supported"
                 },
                 {
                     text: "Story",
                     dataIndex: "FormattedID",
                     flex: 1,
                     xtype: "templatecolumn",
                     tpl: Ext.create("Rally.ui.renderer.template.FormattedIDTemplate")
                 }, 
                {
                    text: "For Feature",
                    dataIndex: "Feature",
                    flex: 1,
                    xtype: "templatecolumn",
                    tpl: Ext.create("Rally.ui.renderer.template.FeatureTemplate", {attributeName:'Feature'})
                }
            ]
        }), this.add(this._myGrid);
        
        // override the event publish to prevent random refreshes of the whole app when the cell changes
        var celledit = this._myGrid.plugins[0];
        var oldPub = celledit.publish;
        var newPub = function(event, varargs) {
            if (event !== "objectupdate") {
                oldPub.apply(this, arguments);
            }
            else {
                // no-op
            }
        };

        celledit.publish = Ext.bind(newPub, celledit);
    },
    _updateGrid: function(myStore) {
        if (this._myGrid === undefined) {
            this._createGrid(myStore);
        }
        else {
            console.log("Refreshing Grid");
            //this._myGrid.reconfigure(myStore);
            this._myGrid.destroy();
            this._createGrid(myStore);
        }
    },

    onTimeboxScopeChange: function(newTimeboxScope) {
        console.log("Timebox Changed called");
        this._timeboxScope = newTimeboxScope;
        var newFilter = Ext.create('Rally.data.QueryFilter',
            {
                property: 'DependencyDescription',
                operator: '!=',
                value: ''
            });

        newFilter = newFilter.and(this._timeboxScope.getQueryFilter());
        console.log("New Filter: ", newFilter.toString());
        var store = this._myGrid.getStore();
        store.clearFilter(true);
        store.filter(newFilter);
    }
});