/*******************************************************************************
 * Copyright (c) 2013 Max Schaefer.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Max Schaefer - initial API and implementation
 *******************************************************************************/
 
 /*global require exports */
 
 var Model = require('./Model').Model,
     ObjModel = require('./ObjModel').ObjModel,
     isIdentifier = require('./util').isIdentifier;

function ArrayModel(pp_id) {
	Model.call(this);
	this.pp_id = arguments.length ? pp_id : this.id;
	this.property_models = {};
}
ArrayModel.prototype = Object.create(ObjModel.prototype);

ArrayModel.cache = {};
ArrayModel.make = function(pos) {
	if(!pos || pos.start_offset === -1)
		return new ArrayModel();
	return ArrayModel.cache[pos.start_offset] || (ArrayModel.cache[pos.start_offset] = new ArrayModel(pos.start_offset));
};

ArrayModel.prototype.normalisePropName = function(prop) {
	// merge non-identifier, non-index properties
	return isIdentifier(prop) || Number(prop) >= 0 ? prop : '*';
};

exports.ArrayModel = ArrayModel;