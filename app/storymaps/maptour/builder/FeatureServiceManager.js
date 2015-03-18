define(["esri/request", "dojo/_base/lang"], 
	function(esriRequest, lang){
		return {
			restoreFS: function()
			{
				$.each(app.data.getTourPoints(true), function(i, tourPoint){
					if( tourPoint.hasBeenUpdated() && ! app.data.hasBeenAdded(tourPoint) )
						tourPoint.restoreOriginal();
				});
			},
			saveFS: function(successCallback, errorCallback)
			{
				// For FS without attachments
				var addedFeatures = app.data.getAddedPoints();
				var updatedTourPoints = [], updatedFeatures = [];
				var droppedFeatures = app.data.getDroppedPointsGraphics();
				$.each(app.data.getTourPoints(true), function(i, tourPoint){
					if (tourPoint.hasBeenUpdated()) {
						updatedTourPoints.push(tourPoint);
						updatedFeatures.push(tourPoint.getUpdatedFeature());
					}
				});
				
				var applyEditRQ = lang.hitch(this, function() {
					this.fsApplyEdits(
						app.data.getSourceLayer(),
						addedFeatures,
						updatedFeatures,
						droppedFeatures,
						function(addedFeatures, updatedFeatures, deletedFeatures){
							if( ! addedFeatures || ! updatedFeatures || ! deletedFeatures ) {
								errorCallback();
								return;
							}
							
							var rqFail = false;
							var results = [].concat(addedFeatures).concat(updatedFeatures).concat(deletedFeatures);
							$.each(results, function(i, result){
								if ( ! result.success )
									rqFail = true;
							});
							
							if ( rqFail ) {
								// TODO added points should be cleaned
								// Can lead to points added multiple times
								
								// TODO should only flag the points that failed better
								$.each(updatedTourPoints, function(i, point){
									point.setUpdateFailed();
								});
								
								// TODO removed points should be cleaned
								// Not an issue to delete a point non existing
								
								errorCallback();
								return;
							}
							
							$.each(updatedTourPoints, function(i, point){
								point.cleanUpdateFailed();
							});
							
							successCallback();
						},
						function(error){
							$.each(updatedTourPoints, function(i, point){
								point.setUpdateFailed();
							});
							errorCallback(error);
						}
					);
				});
				
				if ( addedFeatures.length > 0 || updatedFeatures.length > 0 || droppedFeatures.length > 0 ) {
					var layer = app.data.getSourceLayer();
					// If the layer has StaticData -> need to set it to false for update to be stable
					// Eventually this should be reset to true for performance
					// But AGOL doesn't do it immediately after the request, so not sure when is a good time...
					if( layer && layer._params && layer._params.resourceInfo && layer._params.resourceInfo.hasStaticData ) {
						var urlSplit = layer.url.split('/');
						if( urlSplit.length == 10 ) {							
							esriRequest(
								{
									url: urlSplit.slice(0,5).join('/') + '/admin/services/' + urlSplit[7] + ".FeatureServer/updateDefinition",
									content: {
										"f": 'json',
										"updateDefinition": "{\"hasStaticData\": false}"
									},
									handleAs: 'json'
								},
								{
									usePost: true
								}
							).then(
								function(){
									layer._params.resourceInfo.hasStaticData = false;
									applyEditRQ();
								},
								applyEditRQ
							);
						}
						else
							applyEditRQ();
					}
					else
						applyEditRQ();
				}
				else
					successCallback();
			},
			fsApplyEdits: function(layer, adds, updates, deletes, successCallback, errorCallback)
			{
				var fsRequest = layer.applyEdits(adds, updates, deletes);
				fsRequest.then(successCallback, errorCallback);
			},
			fsAddAttachment: function(layer, objectId, formId, successCallback, errorCallback)
			{
				layer.addAttachment(objectId, document.getElementById(formId), successCallback, errorCallback);
			},
			
			//
			// Add new tour point
			//
			
			/**
			 * Save the new tour point in a Feature Service.
			 * Sequential operations :
			 *  - create a feature based on tourPoint
			 *  - upload the picture based on pictureData
			 *  - upload the thumbnail based on thumbnailData
			 *  - call the callback
			 * @param {Object} tourPoint
			 * @param {Object} pictureData
			 * @param {Object} thumbnailData
			 * @param {Object} callback
			 */
			addFSNewTourPointUsingData: function(tourPoint, pictureData, thumbnailData, callback)
			{
				var that = this;
				
				this.fsApplyEdits(
					app.data.getSourceLayer(), 
					[tourPoint], 
					null, 
					null,
					function(result) {
						if (!result || !result[0] || !result[0].success)
							callback(false);
						else
							that.uploadPictureAndThumbnailUsingData(result[0].objectId, pictureData, thumbnailData, callback);
					},
					function(error){
						callback(false, error);
					}
				);
			},
			addTemporaryTourPointUsingForm: function(tourPoint, pictureFormId, callback)
			{
				var that = this;
				
				this.fsApplyEdits(
					app.data.getSourceLayer(),
					[tourPoint],
					null,
					null,
					function(result) {
						if (!result || !result[0] || !result[0].success)
							callback(false);
						else
							that.uploadPictureUsingForm(result[0].objectId, pictureFormId, callback);
					},
					function(error){
						callback(false, error);
					}
				);
			},
			saveTemporaryTourPointUsingForm: function(objectId, tourPoint, thumbnailFormId, callback)
			{
				var that = this;
				
				this.fsApplyEdits(
					app.data.getSourceLayer(),
					null,
					[tourPoint],
					null,
					function(addedFeatures, updatedFeatures){
						if (!updatedFeatures || !updatedFeatures[0] || !updatedFeatures[0].success)
							callback(false);
						else
							that.uploadPictureUsingForm(objectId, thumbnailFormId, callback);
					},
					function(error){
						callback(false, error);
					}
				);
			},
			
			//
			// Edit a tour point
			//
			
			/**
			 * Change the picture and thumbnail of the feature objectId
			 *  - Query feature attachments
			 *  - Drop all attachments
			 *  - Add new attachments
			 * @param {Object} objectId
			 * @param {Object} pictureData
			 * @param {Object} thumbnailData
			 * @param {Object} callback
			 */
			changePicAndThumbUsingData: function(objectId, pictureData, thumbnailData, callback)
			{
				var that = this;
				
				this.deleteAllAttachments(objectId, function(isSuccess){
					if( isSuccess )
						that.uploadPictureAndThumbnailUsingData(objectId, pictureData, thumbnailData, callback);
					else
						callback(false);
				});
			},
			changeThumbnailUsingData: function(objectId, thumbnailData, callback)
			{
				var that = this;
				
				this.deleteThumbnailAttachment(objectId, function(isSuccess){
					if( isSuccess )
						that.uploadThumbnailUsingData(objectId, thumbnailData, callback);
					else
						callback(false);
				});
			},
			changePicAndThumbUsingForm: function(objectId, pictureFormId, thumbnailFormId, callback)
			{
				var that = this;
				
				this.deleteAllAttachments(objectId, function(isSuccess){
					if( isSuccess )
						that.uploadPictureAndThumbnailUsingForm(objectId, pictureFormId, thumbnailFormId, callback);
					else
						callback(false);
				});
			},
					
			//
			// Attachment management
			//
			
			deleteAllAttachments: function(objectId, callback)
			{
				app.data.getSourceLayer().queryAttachmentInfos(
					objectId,
					function(attachmentInfos) {
						// TODO Seems that bulk delete is not working in ArcGIS for Orga => Test more and report
	
						//var attachmentIds = [];
						var errorDuringDelete = false;
						$.each(attachmentInfos, function(i, attachment){
							//attachmentIds.push(attachment.id);
							if( errorDuringDelete )
								return;
	
							app.data.getSourceLayer().deleteAttachments(
								objectId,
								[attachment.id],
								function() { },
								function() {
									errorDuringDelete = true;
									callback(false);
								}
							);
						});
						
						if( ! errorDuringDelete )
							callback(true);
						else
							callback(false);
	
						/*
						app.data.getSourceLayer().deleteAttachments(
							objectId,
							attachmentIds,
							function() {
								uploadPictureAndThumbnailUsingData(objectId, pictureData, thumbnailData, callback);
							},
							function() {
								callback(false);
							}
						);
						*/
					},
					function(){
						callback(false);
					}
				);
			},
			deleteThumbnailAttachment: function(objectId, callback)
			{
				app.data.getSourceLayer().queryAttachmentInfos(
					objectId,
					function(attachmentInfos) {
						// Sort attachment by ID and remove the first attachement
						var attachmentIds = [];
						$.each(attachmentInfos, function(i, attachment){
							attachmentIds.push(attachment.id);
						});
						attachmentIds = attachmentIds.sort().slice(1);
						
						// Delete all but first attachments
						var errorDuringDelete = false;
						$.each(attachmentIds, function(i, id){
							if( errorDuringDelete )
								return;
							
							app.data.getSourceLayer().deleteAttachments(
								objectId,
								[id],
								function() { },
								function() {
									errorDuringDelete = true;
								}
							);
						});
						
						if( ! errorDuringDelete )
							callback(true);
						else
							callback(false);
					},
					function(){
						callback(false);
					}
				);
			},
			uploadPictureAndThumbnailUsingData: function(objectId, pictureData, thumbnailData, callback)
			{
				var that = this;
				var picRq = this.uploadFeatureAttachmentFromData(app.data.getSourceLayer().url, objectId, pictureData, "picture.jpg");
				var errorHandler = function(){ callback(false); };
	
				picRq.then(function(result)
					{
						var picID = result.addAttachmentResult.objectId;
						var thumbRq = that.uploadFeatureAttachmentFromData(app.data.getSourceLayer().url, objectId, thumbnailData, "thumbnail.jpg");
						thumbRq.then(function(result)
							{
								var thumbID = result.addAttachmentResult.objectId;
								callback(true, objectId, picID, thumbID);
							},
							errorHandler
						);
		
					},
					errorHandler
				);
			},
			uploadThumbnailUsingData: function(objectId, thumbnailData, callback)
			{
				var thumbRq = this.uploadFeatureAttachmentFromData(app.data.getSourceLayer().url, objectId, thumbnailData, "thumbnail.jpg");
				var errorHandler = function(){ callback(false); };
	
				thumbRq.then(function(result)
					{
						var thumbID = result.addAttachmentResult.objectId;
						callback(true, objectId,  thumbID);
					},
					errorHandler
				);
			},
			uploadPictureAndThumbnailUsingForm: function(objectId, pictureFormId, thumbnailFormId, callback)
			{
				var that = this;
				
				this.uploadPictureUsingForm(objectId, pictureFormId, function(success, id, imgID){
					if( success )
						that.uploadPictureUsingForm(objectId, thumbnailFormId, function(success2, id2, thumbID){
							if (success2) {
								callback(true, id, imgID, thumbID);
							}
							else 
								callback(false);
						});
					else
						callback(false);
				});
			},
			uploadFeatureAttachmentFromData: function(fsURL, objectID, data, name)
			{
				var formdata = new FormData();
				formdata.append("attachment", this.dataURItoBlob(data), name);
				formdata.append("f", "json");
	
				return esriRequest(
					{
						url: fsURL + '/' + objectID + '/addAttachment',
						form: formdata
					},
					{
						usePost: true
					}
				);
			},
			dataURItoBlob: function(dataURI)
			{
				var binary = atob(dataURI.split(',')[1]);
				var ab = new ArrayBuffer(binary.length);
				var ia = new Uint8Array(ab);
				for (var i = 0; i < binary.length; i++) {
					ia[i] = binary.charCodeAt(i);
				}
				
				try {
					// Should be [ia] but fail on iOS
					// The loop that popuplate ia that isn't use is also needed for iOS
					return new Blob([ab], { type: "image/jpeg" });
				}
				catch(e) {
					window.BlobBuilder = window.BlobBuilder ||
						window.WebKitBlobBuilder ||
						window.MozBlobBuilder ||
						window.MSBlobBuilder;
				
					var bb = new BlobBuilder();
					bb.append(ab);
					return bb.getBlob({ type: "image/jpeg" });
				}
			},
			uploadPictureUsingForm: function(objectId, formId, callback)
			{
				this.fsAddAttachment(
					app.data.getSourceLayer(),
					objectId,
					formId,
					function(result) {
						if( ! result.success || result.attachmentId == null )
							callback(false);
						else
							callback(true, objectId, result.attachmentId);
					},
					function() {
						callback(false);
					}
				);
			}
		};
	}
);