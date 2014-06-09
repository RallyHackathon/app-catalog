Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    height: 100,
    //items:{ html:'<a href="https://help.rallydev.com/apps/2.0rc2/doc/">App SDK 2.0rc2 Docs</a>'},
    launch: function() {
        
        var timeboxScope = this.getContext().getTimeboxScope();
        if(timeboxScope) {
            this.onTimeboxScopeChange(timeboxScope);
        }
        else{
            this.releaseCombobox = this.add({
                xtype: "rallyreleasecombobox",
                listeners: {
                    ready: this._onReleaseComboboxChanged,//this._onReleaseComboboxLoad,
                    change: this._onReleaseComboboxChanged,
                    scope: this
                }
            });            
        }
    },
    
    onTimeboxScopeChange: function(newTimeboxScope) {
        console.log("TIMEBOX VELOCITY CALLED!: ", newTimeboxScope);
        var record = newTimeboxScope.getRecord();
        this._loadIterations(Rally.util.DateTime.toIsoString(record.get('ReleaseStartDate')), Rally.util.DateTime.toIsoString(record.get('ReleaseDate')));
    },
    
    //_onReleaseComboboxLoad: function() {
    //    var query = this.releaseCombobox.getQueryFromSelected();
    //    console.log("QueryLoad: ", query);
    //    var releaseStartDate = query.config.property.value.value;
    //    var releaseDate = query.config.value.value;
    //    this._loadIterations(releaseStartDate, releaseDate);
    //},
    _onReleaseComboboxChanged: function() {
        console.log("App ComboBox Changed: ", query);
        var query = this.releaseCombobox.getQueryFromSelected();
        this._loadIterations(query.config.property.value.value, query.config.value.value);
        
        //if(this._myGrid) {
        //    var store = this._myGrid.getStore();
        //    store.clearFilter(!0), store.filter(this.releaseCombobox.getQueryFromSelected());
        //}
        //else {
        //    var query = this.releaseCombobox.getQueryFromSelected();
        //    this._loadIterations(query.config.property.value.value, query.config.value.value);
        //}
    },

    _loadIterations: function(startDate, EndDate) {
        Ext.create("Rally.data.WsapiDataStore", {
            model: "UserStory",
            autoLoad: true,
            filters: [{
                property: "Iteration.StartDate",
                operator: ">=",
                value: startDate
                },
                {
                    property: "Iteration.EndDate",
                    operator: "<=",
                    value: EndDate  
                }],
            remoteSort: false,
            listeners: {
                load: function(store, records, success) {
                    this._fetchTotalPlanEstimate(records);
                },
                update: function(store, rec, modified, opts) {
                    this._fetchTotalPlanEstimate(records);
                },
                scope: this
            },
            fetch: ["Name", "Iteration", "PlanEstimate", "PlannedVelocity"]
        });
    },
    _fetchTotalPlanEstimate: function(stories) {
        var iterationGroups = _.groupBy(stories, function(s) {
            return s.get("Iteration").Name;
        });
        
        var totals = _.map(_.keys(iterationGroups), function(key) {
            return {    
                name:key, 
                plannedVelocity:iterationGroups[key][0].get("Iteration").PlannedVelocity,
                total:_.reduce(iterationGroups[key], function(sum, s) {
                    return sum + s.get("PlanEstimate");
                }, 0)
            };
        });
        totals = _.sortBy(totals, 'name');
        //console.log("Totals: ", totals);
        // transform the array so that the iteration names are the column headers
        // and the plan estimate total and planned velocity are rows below the 
        // iteration
        this._displayFields = [];
        this._displayFields.push({text: "", dataIndex: 'header', renderer: function(value) {
            return '<div class="' + value.toLowerCase() + '">' + value + '</div>';
        }});
        var data = [{header: 'Estimated'}, {header: 'Planned'}];

        _.forEach(totals, function(record, index) { 
            data[0][record.name] = record.plannedVelocity;
            data[1][record.name] = record.total;
            this._displayFields.push({text: record.name, dataIndex: record.name, flex: 1});
        }, this);
        
        // create the data store
        var store = Ext.create('Rally.data.custom.Store', {
            data: data
        });
        //console.log("Store: ", store);
        this._updateGrid(store);
    },
    _createGrid: function(records) {
        this._myGrid = this.add({
            xtype: 'rallygrid',
            title: "Velocity",
            store: records,
            showPagingToolbar: false,
            viewConfig: {
                stripeRows: true
            },
            columnCfgs: this._displayFields
        });

    },
    _updateGrid: function(myStore) {
        if (this._myGrid === undefined) {
            //console.log("Create: ", myStore);
            this._createGrid(myStore);
        }
        else {
            //console.log("Reconfigure: ", myStore);
            this._myGrid.reconfigure(myStore);
            // Reconfiguring isn't working quite right, so Destroy & ReCreate.
            this._myGrid.destroy();
            this._createGrid(myStore);
        }
    }
});