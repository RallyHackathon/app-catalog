(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("Rally.apps.charts.rpm.PortfolioChartAppBase", {
        extend: "Rally.app.App",
        settingsScope: "workspace",

        requires: [
            'Rally.apps.charts.rpm.ChartSettings',
            'Rally.ui.combobox.ComboBox',
            'Rally.util.Test',
            'Deft.Deferred'
        ],

        mixins: [
            'Rally.apps.charts.DateMixin',
            'Rally.Messageable'
        ],

        scheduleStates: ["Defined", "In-Progress", "Completed", "Accepted"],

        PI_SETTING: "portfolioItemPicker",
        
        layout: {
            type:   'vbox',
            align:  'stretch'
        },

        items: [
            {
                xtype:  'container',
                itemId: 'top',
                items: [{
                    xtype:  'container',
                    itemId: 'header',
                    cls:    'header'
                }],
                height: 420
            },
            {
                xtype:  'container',
                itemId: 'bottom'
            }
        ],

        getSettingsFields: function () {
            return this.chartSettings.getSettingsConfiguration();
        },

        clientMetrics: {
            beginEvent:     'updateBeforeRender',
            endEvent:       'updateAfterRender',
            description:    'pichartapp - elapsed chart load'
        },

        launch: function () {
            this._setupEvents();
            this._setupChartSettings();
            // if(Rally.environment.getContext().getSubscription().isModuleEnabled('Rally Portfolio Manager')) {
            //     Rally.data.util.PortfolioItemHelper.loadTypeOrDefault({
            //         typeRef: this.getSetting('type'),
            //         context: this.getContext().getDataContext(),
            //         defaultToLowest: false,
            //         success: this.addTreeForType,
            //         scope: this
            //     });
            // } else {
            //     this.add({
            //         xtype:  'container',
            //         html:   '<div class="rpm-turned-off" style="padding: 50px; text-align: center;">You do not have RPM enabled for your subscription</div>'
            //     });

            //     if (Rally.BrowserTest) {
            //         Rally.BrowserTest.publishComponentReady(this);
            //     }
            // }
            this._drawHeader();
            this._setDefaultConfigValues();
            this._setupUpdateBeforeRender();
            //this._loadSavedPortfolioItem();
            this._subscribeToPortfolioTree();
        },

        _setupChartSettings: function () {
            this.chartSettings = Ext.create("Rally.apps.charts.rpm.ChartSettings", {
                app: this
            });
        },

        _subscribeToPortfolioTree: function() {
            this.subscribe('portfoliotreeitemselected', this._onPortfolioTreeItemSelected, this);        
        },
        
        _onPortfolioTreeItemSelected: function(treeItem) {
            this.currentPiRecord = treeItem.getRecord();
            
            this._onPortfolioItemChanged();
            //this._loadPortfolioItem(this.currentPiRecord.get('_ref'));
        },
        
        _removeChildrenGridAndChart: function() {
            var childGrid = this.down('rallygrid'),
                chart = this.down('rallychart');
                
            if (childGrid) {
                childGrid.destroy();
            }
            
            if (chart) {
                chart.destroy();
            }
        },

        _setupUpdateBeforeRender: function () {
            this.chartComponentConfig.updateBeforeRender = this._setupDynamicHooksWithEvents(
                this.chartComponentConfig.updateBeforeRender,
                'updateBeforeRender'
            );

            this.chartComponentConfig.updateAfterRender = this._setupDynamicHooksWithEvents(
                this.chartComponentConfig.updateAfterRender,
                'updateAfterRender'
            );
        },

        _setupDynamicHooksWithEvents: function (func, event) {
            var self = this;

            return function () {
                self.fireEvent(event);
                if ('function' === typeof func) {
                    func.apply(this);
                }
            };
        },

        _setupEvents: function () {
            this.addEvents(
                'updateBeforeRender',
                'updateAfterRender'
            );
        },

        _addHelpComponent: function () {
            this.down('#header').add(this._buildHelpComponent());
        },

        _setDefaultConfigValues: function () {
            var config = Ext.clone(this.chartComponentConfig);
            
            config.storeConfig.find = config.storeConfig.find || {};
            
            config.calculatorConfig = config.calculatorConfig || {};

            config.chartConfig = config.chartConfig || {};
            config.chartConfig.title = config.chartConfig.title || {};
            config.chartConfig.xAxis = config.chartConfig.xAxis || {};
            config.chartConfig.xAxis.type = config.chartConfig.xAxis.type || "datetime";
            config.chartConfig.yAxis = config.chartConfig.yAxis || [
                {
                    title: {}
                }
            ];

            this.chartComponentConfig = config;
        },

        _buildHelpComponent: function () {
            return Ext.create('Ext.Component', {
                renderTpl: Rally.util.Help.getIcon({
                    cls: Rally.util.Test.toBrowserTestCssClass(this.help.cls),
                    id: this.help.id
                })
            });
        },
        
        _validateSettingsChoices: function () {
            var startDate = this._getSettingStartDate(),
                endDate = this._getSettingEndDate(),
                dataType = this.getSetting("chartAggregationType"),
                invalid = function (value) {
                    return !value || value === "undefined";
                };

            if (invalid(startDate) || invalid(endDate) || invalid(dataType)) {
                return false;
            }
            return true;
        },

        _getSettingStartDate: function() {
            return this.getSetting("startdate") || this.getSetting("startDate");
        },

        _getSettingEndDate: function() {
            return this.getSetting("enddate") || this.getSetting("endDate");
        },

        _savedPortfolioItemValid: function (savedPi) {
            return !!(savedPi && savedPi._type && savedPi.ObjectID && savedPi.Name);
        },
        
        _onSelectionChange: function(grid, selected) {
            this.down('rallychart').destroy();
            
            if(this.onlyStoriesInCurrentProject){
                this.chartComponentConfig.storeConfig.find._ItemHierarchy = {
                    $in: _.map('Project', this._getGlobalContext().getDataContext().project)
                };
                this.chartComponentConfig.storeConfig.find._ItemHierarchy = {
                    $in: _.map(selected, function(record) {
                        return record.getId();    
                    })
                };
            } else {
                this.chartComponentConfig.storeConfig.find._ItemHierarchy = {
                    $in: _.map(selected, function(record) {
                        return record.getId();    
                    })
                };
            }
            
            this.down('#top').add(this.chartComponentConfig);
        },
        
        _onChildrenRetrieved: function(store, records) {
            var grid = this.down('#bottom').add({
                xtype: 'rallygrid',
                store: store,
                columnCfgs: ['FormattedID', 'Name', 'Project'],
                showRowActionsColumn: false,
                selType: 'checkboxmodel',
                selModel: {
                    mode: 'SIMPLE'
                },
                enableEditing: false,
                sortableColumns: false,
                autoScroll: true,
                height: 500,
                showPagingToolbar: false
            });
            
            if(!this.onlyStoriesInCurrentProject){
                grid.getSelectionModel().selectAll(true);
            }
            grid.on('selectionchange', this._onSelectionChange, this);
        },
        
        _onChildrenRetrievedMilestone: function(store, records) {
            var grid = this.down('#bottom').add({
                xtype: 'rallygrid',
                store: store,
                columnCfgs: ['FormattedID', 'Name'],
                showRowActionsColumn: false,
                //seltype: 'rowmodel',
                selType: 'checkboxmodel',
                //model: 'userStoryModel',
                selModel: {
                    mode: 'SIMPLE'
                },
                enableEditing: false,
                sortableColumns: false,
                autoScroll: true,
                height: 500,
                showPagingToolbar: false
            });
            
            if(!this.onlyStoriesInCurrentProject){
                grid.getSelectionModel().selectAll(true);
            }
            grid.on('selectionchange', this._onSelectionChange, this);
        },

        _showGrid: function() {
            var piRecord = this.currentPiRecord,
                piData = piRecord.data,
                piLevel = piRecord.self.ordinal,
                filters;
            
            if (this._getShowGridCheckbox().getValue() !== true) {
                return;
            }
                
            if (!this._savedPortfolioItemValid(piData)) {
                this._portfolioItemNotValid();
                return;
            }
            
            if (piLevel === 0 && this.onlyStoriesInCurrentProject) {
                filters = {
                    property: 'Project',
                    operator: '=',
                    value: this._getGlobalContext().getDataContext().project
                };
            }
            
            piRecord.getCollection(piLevel === 0 ? 'UserStories' : 'Children', {
                autoLoad: true,
                filters: filters,
                listeners: {
                    load: piLevel === 1 ? this._onChildrenRetrievedMilestone : this._onChildrenRetrieved,
                    scope: this
                },
                limit: Infinity
            });    
        },
        
        _getShowGridCheckbox: function() {
            return this.down('#show-grid-checkbox-element');
        },
        
        _showChart: function() {
            var piRecord = this.currentPiRecord,
                piData = piRecord.data;
                
             
            Rally.data.ModelFactory.getModel({
                type: 'UserStory',
                success: function (model) {
                    this._onUserStoryModelRetrieved(model, piRecord);
                },
                scope: this
            });
        },

        _onUserStoryModelRetrieved: function (model, piRecord) {
            var piRecordData = piRecord.data,
                dataContext = this.getContext().getDataContext();
                
            this._updateChartComponentConfig(model, piRecordData).then({
                success: function (chartComponentConfig) {
                    if( piRecord.self.ordinal === 0 && this.onlyStoriesInCurrentProject){
                        // this.chartComponentConfig.storeConfig.find._ItemHierarchy = {
                        //     $in: _.map('Project', this._getGlobalContext().getDataContext().project)
                        // };
                        this.chartComponentConfig.storeConfig.find.Project = Rally.util.Ref.getOidFromRef(dataContext.project);
                            
                    }
                    
                    this.down('#top').add(chartComponentConfig);
                    Rally.environment.getMessageBus().publish(Rally.Message.piChartAppReady);
                },
                scope: this
            });
        },

        _updateChartComponentConfig: function (model, portfolioItem) {
            var deferred = Ext.create('Deft.Deferred');

            this._getScheduleStateValues(model).then({
                success: function (scheduleStateValues) {
                    this.chartComponentConfig.calculatorConfig.scheduleStates = scheduleStateValues;

                    this._setDynamicConfigValues(portfolioItem);
                    this._calculateDateRange(portfolioItem);
                    this._updateQueryConfig(portfolioItem);

                    deferred.resolve(this.chartComponentConfig);
                },
                scope: this
            });

            return deferred.promise;
        },

        _getScheduleStateValues: function (model) {
            var deferred = Ext.create('Deft.Deferred');

            if (model) {
                model.getField('ScheduleState').getAllowedValueStore().load({
                    callback: function (records, operation, success) {
                        var scheduleStateValues = Ext.Array.map(records, function (record) {
                            return record.get('StringValue');
                        });
                        deferred.resolve(scheduleStateValues);
                    },
                    scope: this
                });
            } else {
                deferred.resolve(this.scheduleStates);
            }

            return deferred.promise;
        },

        _setDynamicConfigValues: function (portfolioItem) {
            this._updateChartConfigDateFormat();
            this.chartComponentConfig.chartConfig.title = this._buildChartTitle(portfolioItem);
            //TODO: uncomment this line prior to deploy
            //this.chartComponentConfig.chartConfig.subtitle = this._buildChartSubtitle(portfolioItem);

            this.chartComponentConfig.calculatorConfig.chartAggregationType = this._getAggregationType();
            this.chartComponentConfig.chartConfig.yAxis[0].title.text = this._getYAxisTitle();

            this.chartComponentConfig.chartConfig.yAxis[0].labels = {
                x: -5,
                y: 4
            };
        },

        _updateChartConfigDateFormat: function () {
            var self = this;

            this.chartComponentConfig.chartConfig.xAxis.labels = {
                x: 0,
                y: 20,
                formatter: function () {
                    return self._formatDate(self.dateStringToObject(this.value));
                }
            };
        },

        _parseRallyDateFormatToHighchartsDateFormat: function () {
            var dateFormat = this._getUserConfiguredDateFormat() || this._getWorkspaceConfiguredDateFormat();

            for (var i = 0; i < this.dateFormatters.length; i++) {
                dateFormat = dateFormat.replace(this.dateFormatters[i].key, this.dateFormatters[i].value);
            }

            return dateFormat;
        },

        _formatDate: function (date) {
            if (!this.dateFormat) {
                this.dateFormat = this._parseRallyDateFormatToHighchartsDateFormat();
            }

            return Highcharts.dateFormat(this.dateFormat, date.getTime());
        },

        _calculateDateRange: function (portfolioItem) {
            var calcConfig = this.chartComponentConfig.calculatorConfig;
            calcConfig.startDate = calcConfig.startDate || this._getChartStartDate(portfolioItem);
            calcConfig.endDate = calcConfig.endDate || this._getChartEndDate(portfolioItem);
            calcConfig.timeZone = calcConfig.timeZone || this._getTimeZone();

            this.chartComponentConfig.chartConfig.xAxis.tickInterval = this._configureChartTicks(calcConfig.startDate, calcConfig.endDate);
        },

        _updateQueryConfig: function (portfolioItem) {
            this.chartComponentConfig.storeConfig.find._ItemHierarchy = portfolioItem.ObjectID;
        },

        _configureChartTicks: function (startDate, endDate) {
            var pixelTickWidth = 125,
                appWidth = this.getWidth(),
                ticks = Math.floor(appWidth / pixelTickWidth);

            var startDateObj = this.dateStringToObject(startDate),
                endDateObj = this.dateStringToObject(endDate);

            var days = Math.floor((endDateObj.getTime() - startDateObj.getTime()) / 86400000);

            return Math.floor(days / ticks);
        },

        _getUserConfiguredDateFormat: function () {
            return this.getContext().getUser().UserProfile.DateFormat;
        },

        _getWorkspaceConfiguredDateFormat: function () {
            return this.getContext().getWorkspace().WorkspaceConfiguration.DateFormat;
        },

        _buildChartTitle: function (portfolioItem) {
            var widthPerCharacter = 10,
                totalCharacters = Math.floor(this.getWidth() / widthPerCharacter),
                title = "Portfolio Item Chart",
                align = "center";

            if (portfolioItem) {
                title = portfolioItem.FormattedID + ": " + portfolioItem.Name;
            }

            if (totalCharacters < title.length) {
                title = title.substring(0, totalCharacters) + "...";
                align = "left";
            }

            return {
                text: title,
                align: align,
                margin: 30
            };
        },

        _buildChartSubtitle: function (portfolioItem) {
            var widthPerCharacter = 6,
                totalCharacters = Math.floor(this.getWidth() / widthPerCharacter),
                plannedStartDate = "",
                plannedEndDate = "";

            var template = Ext.create("Ext.XTemplate",
                '<tpl if="plannedStartDate">' +
                    '<span>Planned Start: {plannedStartDate}</span>' +
                    '    <tpl if="plannedEndDate">' +
                    '        <tpl if="tooBig">' +
                    '            <br />' +
                    '        <tpl else>' +
                    '            &nbsp;&nbsp;&nbsp;' +
                    '        </tpl>' +
                    '    </tpl>' +
                    '</tpl>' +
                    '<tpl if="plannedEndDate">' +
                    '    <span>Planned End: {plannedEndDate}</span>' +
                    '</tpl>'
            );

            if (portfolioItem && portfolioItem.PlannedStartDate) {
                plannedStartDate = this._formatDate(portfolioItem.PlannedStartDate);
            }

            if (portfolioItem && portfolioItem.PlannedEndDate) {
                plannedEndDate = this._formatDate(portfolioItem.PlannedEndDate);
            }

            var formattedTitle = template.apply({
                plannedStartDate: plannedStartDate,
                plannedEndDate: plannedEndDate,
                tooBig: totalCharacters < plannedStartDate.length + plannedEndDate.length + 60
            });

            return {
                text: formattedTitle,
                useHTML: true,
                align: "center"
            };
        },

        _getAggregationType: function () {
            return this.getSetting("chartAggregationType");
        },

        _getYAxisTitle: function () {
            return this._getAggregationType() === "storypoints" ?
                "Points" :
                "Count";
        },

        _getChartStartDate: function (portfolioItem) {
            // var startDateSetting = this._getSettingStartDate().split(","),
            //     settingValue = startDateSetting[0],
            var    startDate;

            // if(startDateSetting[0] === "selecteddate") {
            //     startDate = this.dateStringToObject(startDateSetting[1]);
            // } else {
            //     startDate = this._dateFromSettingValue(portfolioItem, settingValue);
            // }
            if (portfolioItem.PlannedStartDate) {
                startDate = portfolioItem.PlannedStartDate;
            } else if (portfolioItem.ActualStartDate) {
                startDate = portfolioItem.ActualStartDate;
            } else {
                startDate = new Date();
            }

            return this.dateToString(startDate);
        },

        _getChartEndDate: function (portfolioItem) {
            // var endDateSetting = this._getSettingEndDate().split(","),
            //     settingValue = endDateSetting[0],
            var    endDate;

            // if (endDateSetting[0] === "selecteddate") {
            //     endDate = this.dateStringToObject(endDateSetting[1]);
            // } else {
            //     endDate = this._dateFromSettingValue(portfolioItem, settingValue);
            // }
            endDate = new Date();

            return this.dateToString(endDate);
        },

        _dateFromSettingValue: function (portfolioItem, settingValue) {
            var settingsMap = {
                "plannedstartdate": "PlannedStartDate",
                "plannedenddate": "PlannedEndDate",
                "actualstartdate": "ActualStartDate",
                "actualenddate": "ActualEndDate"
            };

            if (settingValue === "today") {
                return new Date();
            }

            if (settingsMap.hasOwnProperty(settingValue)) {
                return portfolioItem[settingsMap[settingValue]];
            }

            return new Date(settingValue);
        },

        _getTimeZone: function () {
            return this.getContext().getUser().UserProfile.TimeZone || this.getContext().getWorkspace().WorkspaceConfiguration.TimeZone;
        },

        _portfolioItemNotValid: function () {
            this._setErrorTextMessage('Cannot find the chosen portfolio item.  Please click the gear and "Edit Settings" to choose another.');
        },

        _setErrorTextMessage: function (message) {
            this.down('#header').add({
                xtype: 'displayfield',
                value: message
            });
        },
        
        //start of project filter functions
        
        _buildFilterInfo: function(){
            return Ext.create('Rally.ui.tooltip.FilterInfo', {
                projectName: this.getSetting('project') && this.getContext().get('project').Name || 'Following Global Project Setting',
                typePath: this.typePath,
                scopeUp: this.getSetting('projectScopeUp'),
                scopeDown: this.getSetting('projectScopeDown'),
                query: this.getSetting('query')
            });
        },
        
        _buildCurrentProjectOnlyCheckbox: function(){
            return Ext.create('Rally.ui.CheckboxField', {
                boxLabel: 'Only Stories in Current Project',
                value: this.onlyStoriesInCurrentProject,
                listeners: {
                    change: this._onOnlyStoriesInCurrentProjectChanged,
                    scope: this
                },
                componentCls: 'current-project-only-float',
                id: 'only-stories-in-current-project-element'
            });
        },
        
        _buildShowGridCheckbox: function() {
            return Ext.create('Rally.ui.CheckboxField', {
                boxLabel: 'Show Grid',
                listeners: {
                    change: this._onShowGridClicked,
                    scope: this
                },
                componentCls: 'show-grid-checkbox-only-float',
                id: 'show-grid-checkbox-element'
            });   
        },
        
        _buildFilterOnReleaseCheckbox: function(){
            return {
                xtype: 'rallycheckboxfield',
                boxLabel: 'Filter Features on Release',
                value: this.filterOnRelease,
                listeners: {
                    change: this._onFilterOnReleaseChanged,
                    scope: this
                },
                componentCls: 'filter-on-release-float'
            };
        },
        
        _buildReleaseCombobox: function(){
             return {
                xtype: 'rallyreleasecombobox',
                listeners: {
                    change: this._onReleaseComboboxChanged,
                    scope: this
                }
                
            };
        },
        
        _onShowGridClicked: function(checkbox) {
            var grid = this.down('rallygrid');
            if (checkbox.getValue() === true) {
                this._showGrid();    
            } else if (grid) {
                grid.destroy();
            }
        },
        
        _onOnlyStoriesInCurrentProjectChanged: function(checkBox) {
            var grid = this.down('rallygrid'),
                chart = this.down('rallychart');
                
            this.onlyStoriesInCurrentProject = checkBox.getValue();
            
            //this._refreshTree();
            if (grid) {
                grid.destroy();
            }
            if (chart) {
                chart.destroy();
            }
            
            this._onPortfolioItemChanged();
            //this._loadPortfolioItem(this.currentPiRecord.get('_ref'));
        },
        
        _onPortfolioItemChanged: function() {
            this._showOrHideCheckboxes();
            this._removeChildrenGridAndChart();
            this._showChart();
            this._showGrid();
        },
        
        _onFilterOnReleaseChanged: function(checkBox) {
            this.filterOnRelease = checkBox.getValue();
            //this._refreshTree();
            this.down('rallygrid').destroy();
            this.down('rallychart').destroy();
            this._loadPortfolioItem(this.currentPiRecord.get('_ref'));
        },
        
        _onReleaseComboboxChanged: function(releaseCombobox){
            if(this.filterOnRelease) {
                //this._refreshTree(); 
                this.down('rallygrid').destroy();
                this.down('rallychart').destroy();
                this._loadPortfolioItem(this.currentPiRecord.get('_ref'));
            }
        },
        
        _showOrHideCheckboxes: function() {
            var piLevel = this.currentPiRecord.self.ordinal,
            currentProjectOnlyCheckbox = this.down('#only-stories-in-current-project-element');
            
            if (piLevel === 0) {
                currentProjectOnlyCheckbox.show();
            } else {
                currentProjectOnlyCheckbox.hide();
            }
        },
        
        _refreshTree: function() {
            this.down('rallyportfoliotree')._refresh();
        },
        
        _drawHeader: function(){
            var header = this.down('#header');
            header.add(this._buildHelpComponent());
            header.add(this._buildFilterInfo());
            header.add(this._buildCurrentProjectOnlyCheckbox());
            header.add(this._buildShowGridCheckbox());
            //header.add(this._buildFilterOnReleaseCheckbox());
            //header.add(this._buildReleaseCombobox());
        },
        
        addTreeForType: function(record){

            this.typePath = record.get('Name');
            var tree = this.buildTreeForType(record);
            this.add(tree);

            tree.on('initialload', function(){
                if (Rally.BrowserTest) {
                    Rally.BrowserTest.publishComponentReady(this);
                }
            }, this);

        },
        
        _getGlobalContext: function() {
            return (this.getContext().getGlobalContext && 
                this.getContext().getGlobalContext()) ||
                //todo: ugly hack until Rally.app.Context.getGlobalContext is available in sdk 2.0
                window.parent.Rally.environment.getContext();
        },
        
        // not currently used. Will need later to add tree selector
        buildTreeForType: function(typeRecord){
            var me = this;

            var filters = [];
            if (this.getSetting('query')) {
                try {
                  filters.push(Rally.data.QueryFilter.fromQueryString(this.getSetting('query')));
                } catch (e) {
                    Rally.ui.notify.Notifier.showError({
                        message: e.message
                    });
                }
            }
           
            var tree = Ext.create('Rally.ui.tree.PortfolioTree', {
                stateful: true,
                stateId: this.getAppId() + 'rallyportfoliotree',
                topLevelModel: typeRecord.get('TypePath'),
                topLevelStoreConfig: {
                    filters: filters,
                    context: this.getContext().getDataContext()
                },
                childItemsStoreConfigForParentRecordFn: function(record) {
                    var storeConfig = {
                        context: {
                            project: undefined,
                            workspace: me.getContext().getDataContext().workspace
                        },
                        fetch: this._getChildLevelFetchFields()
                    };
                    if(record.self.isPortfolioItem() && // ordinal === 0 refers to lowest portfolio level (e.g. feature)
                        record.self.ordinal === 0) { // from checkbox for OnlyStoriesInCurrentProject
                                     
                        if(me.onlyStoriesInCurrentProject) {
                            Ext.apply(storeConfig.context, {
                                project: me._getGlobalContext().getDataContext().project,
                                projectScopeUp: false,//me._getGlobalContext().getDataContext().projectScopeUp?
                                projectScopeDown: false//me._getGlobalContext().getDataContext().projectScopeDown?
                            });
                        } else {
                            storeConfig.sorters = [{
                                property: 'Project',
                                direction: 'ASC'
                            }, {
                                property: 'Rank',
                                direction: 'ASC'
                            }];
                        }
                    } else if(record.self.isPortfolioItem() && 
                        record.self.ordinal === 1) {
                        
                        if(me.filterOnRelease === true) {
                            var selectedRelease = me.down('rallyreleasecombobox').getRecord();
                            var releaseName = selectedRelease.get('Name');
                            //var startDate = tbrecord.get('ReleaseStartDate');
                            var endDate = selectedRelease.get('ReleaseDate');
                            
                            storeConfig.filters = [Rally.data.wsapi.Filter.and([{
                                property: 'Release',
                                operator: '=',
                                value: null 
                            },
                            {
                                property: 'PlannedEndDate',
                                operator: '<',
                                value: Rally.util.DateTime.toIsoString(endDate) //current release end date calculate elsewhere
                            }]).or({
                                property: 'Release.Name',
                                operator: '=',
                                value: releaseName 
                            }).and({
                                property: 'Parent',
                                operator: '=',
                                value: record.get('_ref')
                            })];
                        }

                            //Check out Rally.data.wsapi.Filter
                        /*storeConfig.filters = [{
                            property: 'PlannedEndDate',
                            operator: '<',
                            value: '2014-04-23' //current release end date calculate elsewhere
                        }];*/        
                    }
                    // ToDo: add a features in current release filter here (would need to look at ordinal === 1 since that's the level about Feature)
                    return storeConfig;
                },
                treeItemConfigForRecordFn: function (record) {
                    var config = Rally.ui.tree.PortfolioTree.prototype.treeItemConfigForRecordFn.call(tree, record);
                    if(!me.onlyStoriesInCurrentProject && record.self.typePath === 'hierarchicalrequirement') {
                        config.xtype = 'projectuserstorytreeitem';
                    }
                    return config;
                },
                emptyText: '<p>No portfolio items of this type found.</p>' +
                           '<p>Click the gear to set your project to match the location of your portfolio items or to filter further by type.</p>'
            });
            
            return tree;
        }
        
    });
}());