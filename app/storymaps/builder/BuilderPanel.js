define([], 
	function () {
		return function BuilderPanel(container, builderSave, builderDirectCreationFirstSave, builderGalleryCreationFirstSave) 
		{
			var _this = this;
			var _displayBuilderSaveIntro = true;
			var _builderView = null;

			this.init = function(builderView) 
			{	
				_builderView = builderView;
				initLocalization();
				
				container.show();
				createInitialSavePopover();
				
				app.builder.hideSaveConfirmation = hideSaveConfirmation;
				
				// TODO: slow but using fastClick (make the modal flash - see after bootstrap upgrade)
				container.find('.builder-save').click(save);
				container.find(".builder-share").click(function(){
					app.builder.openSharePopup(false);
				});
				container.find('.builder-settings').click(showSettingsPopup);
				container.find('.builder-help').click(showHelpPopup);
				
				$(window).bind('keydown', function(event) {
					if (event.ctrlKey || event.metaKey) {
						// CTRL+S
						if (String.fromCharCode(event.which).toLowerCase() == 's') {
							if (!container.find('.builder-save').attr("disabled") && ! app.initScreenIsOpen) {
								event.preventDefault();
								save();
							}
						}
					}
				});
			};
			
			//
			// Panel buttons
			//
			
			function save()
			{
				console.log("maptour.builder.Builder - save");
				
				if ( _displayBuilderSaveIntro ) {
					_displayBuilderSaveIntro = false;
					app.isInitializing = false;
					container.find(".builder-save").popover('destroy');
					createSavePopover();
				}
				
				container.find(".builder-save").popover('show');
				changeBuilderPanelButtonState(false);
				
				if (app.isDirectCreationFirstSave) {
					var appTitle = $('#headerDesktop .title .text_edit_label').text();
					var appSubTitle = $('#headerDesktop .subtitle .text_edit_label').text();
					if ( appSubTitle == i18n.viewer.headerJS.editMe )
						appSubTitle = "";
					
					if ( ! appTitle || appTitle == i18n.viewer.headerJS.editMe ) {
						_this.saveFailed("NONAME");
						return;
					}
					
					// Save the webmap
					// If ok get the new id
					// Call saveApp
					// If ok call appSaveSucceeded
					builderDirectCreationFirstSave(appTitle, appSubTitle);
				}
				else if (app.isGalleryCreation) {
					builderGalleryCreationFirstSave();
				}
				else {
					// Save the app 
					// If OK and needed call save webmap 
					// If OK call appSaveSucceeded
					builderSave();
				}
			}
			
			function showSettingsPopup()
			{
				closePopover();
				_builderView.openSettingPopup(false);
			}
			
			function showHelpPopup()
			{
				closePopover();
				app.builder.openHelpPopup();
			}
			
			//
			// Save callbacks
			//
			
			this.saveSucceeded = function()
			{
				container.find(".builder-save").next(".popover").find(".stepSave").css("display", "none");
				container.find(".builder-save").popover('hide');
				
				if( app.isDirectCreationFirstSave || app.isGalleryCreation )
					app.builder.openSharePopup(true);

				closePopover();
				resetSaveCounter();
				changeBuilderPanelButtonState(true);
			};
			
			this.saveFailed = function(source, error)
			{
				container.find(".builder-save").next(".popover").find(".stepSave").css("display", "none");
				
				if( source == "FS" && error && error.code == 400 && error.details && error.details[0] && error.details[0].split('html content').length >= 2 ) {
					container.find(".builder-save").next(".popover").find(".stepFailed2").css("display", "block");
				}
				else if (source == "NONAME") {
					container.find(".builder-save").next(".popover").find(".stepFailed3").css("display", "block");
					
					$("#headerDesktop .title").addClass("titleEmpty");
					
					container.find(".builder-save").attr("disabled", false);
					container.find(".builder-settings").attr("disabled", false);
					container.find(".builder-help").attr("disabled", false);
					
					return;
				}
				else 
					container.find(".builder-save").next(".popover").find(".stepFailed").css("display", "block");
				
				changeBuilderPanelButtonState(true);
			};
			
			//
			// Counter
			//
			
			this.hasPendingChange = function()
			{
				return container.find("#save-counter").html() && container.find("#save-counter").html() != i18n.viewer.builderJS.noPendingChange;
			};
	
			this.incrementSaveCounter = function(nb)
			{
				var value = container.find("#save-counter").html();
				if (! _this.hasPendingChange()) {
					value = 0;
					if (_displayBuilderSaveIntro) {
						// Timer cause the header can be hidden
						setTimeout(function(){
							container.find(".builder-save").popover('show');
						}, 250);
						setTimeout(function(){
							if( _displayBuilderSaveIntro )
								container.find(".builder-save").popover('destroy');
						}, app.isDirectCreationFirstSave || app.isGalleryCreation || app.isInitializing ? 10000 : 3500);
					}
				}
	
				if( value === 0 ) {
					if ( nb == 1 || isNaN(parseInt(nb, 10)) )
						value = i18n.viewer.builderJS.unSavedChangeSingular;
					else
						value = nb + " " + i18n.viewer.builderJS.unSavedChangePlural;
				}
				else
					value = (parseInt(value, 10) + (nb ? nb : 1)) + " " + i18n.viewer.builderJS.unSavedChangePlural;

				container.find("#save-counter").html(value);
				container.find("#save-counter").css("color", "#FFF");
			};
	
			function resetSaveCounter()
			{
				container.find("#save-counter").html(i18n.viewer.builderJS.noPendingChange);
				container.find("#save-counter").css("color", "#999");
			}
			
			//
			// Popover
			//
	
			function closePopover()
			{
				container.find(".builder-save").popover('hide');
			}
	
			function createInitialSavePopover()
			{
				var containerId = "#" + container.attr("id");
	
				// Confirmation that user need to use the save button
				container.find(".builder-save").popover({
					trigger: 'manual',
					placement: 'left',
					html: true,
					content: '<script>$("' + containerId + ' .builder-save").next(".popover").addClass("save-popover");</script>'
								+ i18n.viewer.builderJS.popoverSaveWhenDone
				});
			}
			
			function createSavePopover()
			{
				var containerId = "#" + container.attr("id");

				// App saved confirmation
				container.find(".builder-save").popover({
					containerId: containerId,
					html: true,
					trigger: 'manual',
					placement: 'bottom',
					content: '<script>'
								+ '$("' + containerId + ' .builder-save").next(".popover").addClass("save-popover-2");'
								+ '$("' + containerId + ' .builder-save").next(".popover").find(".stepSave").css("display", "block");'
								+ '$("' + containerId + ' .builder-save").next(".popover").find(".stepHidden").css("display", "none");'
								+ '</script>'
								+ '<div class="stepSave" style="margin-top: 3px">'
								+  i18n.viewer.builderJS.savingApplication + '... <img src="resources/icons/loader-upload.gif" class="addSpinner" alt="Uploading">'
								+ '</div>'
								+ '<div class="stepHidden stepFailed" style="color: red;">'
								+  i18n.viewer.builderJS.saveError + ' '
								+ '<button type="button" class="btn btn-danger btn-small" onclick="app.builder.hideSaveConfirmation()" style="vertical-align: 1px;">'+i18n.viewer.builderJS.gotIt+'</button> '
								+ '</div>'
								+ '<div class="stepHidden stepFailed2" style="color: red;">'
								+  i18n.viewer.builderJS.saveError2 + ' '
								+ '<button type="button" class="btn btn-danger btn-small" onclick="app.builder.hideSaveConfirmation()" style="vertical-align: 1px;">'+i18n.viewer.builderJS.gotIt+'</button> '
								+ '</div>'
								+ '<div class="stepHidden stepFailed3" style="color: red;">'
								+  i18n.viewer.builderJS.saveError3 + ' '
								+ '<button type="button" class="btn btn-danger btn-small" onclick="app.builder.hideSaveConfirmation()" style="vertical-align: 1px;">'+i18n.viewer.builderJS.gotIt+'</button> '
								+ '</div>'
				});
			}
	
			//
			// UI
			//
			
			function hideSaveConfirmation()
			{
				container.find(".builder-save").popover('hide');
				$("#headerDesktop .title").removeClass("titleEmpty");
			}
			
			function changeBuilderPanelButtonState(activate)
			{
				container.find(".builder-cmd").attr("disabled", ! activate);
			}
			
			this.updateSharingStatus = function()
			{
				if( app.isDirectCreationFirstSave || app.isGalleryCreation ) {
					$("#sharing-status").html("<span style='color: #FFF'>; " + i18n.viewer.builderJS.shareStatus1 + "</span>");
					container.find('.builder-share').attr("disabled", "disabled");
				}
				else if ( app.data.getAppItem().access == "public" )
					$("#sharing-status").html("; " + i18n.viewer.builderJS.shareStatus2);
				else if ( app.data.getAppItem().access == "account" )
					$("#sharing-status").html("; " + i18n.viewer.builderJS.shareStatus3);
				else
					$("#sharing-status").html("; " + i18n.viewer.builderJS.shareStatus4);
			};
			
			this.resize = function()
			{
				// Make all buttons the same size
				/*
				var buttonWidth = Math.max(container.find("div > button").eq(0).width(), container.find("div > button").eq(1).width(), container.find("div > button").eq(2).width());
				container.find("div > button").eq(0).width(buttonWidth);
				container.find("div > button").eq(1).width(buttonWidth);
				container.find("div > button").eq(2).width(buttonWidth);
				*/		
				// Reposition
				container.css("margin-left", $("body").width() / 2 - container.outerWidth() / 2);
			};
			
			function initLocalization()
			{
				container.find('h4').html(i18n.viewer.builderHTML.panelHeader);
				container.find('button').eq(0).html(i18n.viewer.builderHTML.buttonSave);
				container.find('button').eq(1).html(i18n.viewer.builderHTML.buttonShare.toUpperCase());
				container.find('button').eq(2).html(i18n.viewer.builderHTML.buttonSettings.toUpperCase());
				container.find('button').eq(3).html(i18n.viewer.builderHTML.buttonHelp.toUpperCase());
				container.find('#save-counter').html(i18n.viewer.builderJS.noPendingChange);
			}
		};
	}
);