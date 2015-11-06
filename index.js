

var ONE_HOUR = 60 * 60 * 1000;
var ONE_DAY = 24 * 60 * 60 * 1000;

var init = function(session) {
  var Store = session.Store;

  var WaterlineStore = function(options) {
    Store.call(this, options);
    var self = this;
    
    self.sessionModel = options.sessionModel;
    self.ttl = options.ttl || 14 * ONE_DAY;
    self.reapInterval = options.reapInterval && options.reapInterval > ONE_HOUR ? options.reapInterval : ONE_HOUR;
    
    self.startReaper();
  }

  WaterlineStore.prototype.__proto__ = Store.prototype;

  WaterlineStore.prototype.reap = function(activeDate) {
    var self = this;

    //NOTE: Could add-> 'and expires != null' to the end of the query criteria
    //if there are problems with expires sometimes being null.
    self.sessionModel
      .destroy({or: [{updatedAt: {'<': activeDate}}, {expires: {'<': new Date()}}]})
      .exec(function(err, models) {
        if(err)
          console.error(err);
      });
  }

  WaterlineStore.prototype.startReaper = function(interval) {
    var self = this;
    var interval = interval ? interval : self.reapInterval;
    //self.reapInterval = interval < ONE_HOUR ? ONE_HOUR : interval;
    var activeDate = new Date(Date.now() - self.ttl);

    self._reaperIntervalId = setInterval(function() {
      console.log('---reap---');
      self.reap(activeDate);
    }, interval);
  }

  WaterlineStore.prototype.stopReaper = function() {
    var self = this;

    clearInterval(self._reaperIntervalId);
  }

  WaterlineStore.prototype.get = function(sid, cb) {
    var self = this;
    var json;

    console.log('session get', sid);
    self.sessionModel
      .findOne({sid: sid})
      .exec(function(err, model) {
        if(err)
          return cb(err);

        if(model) {
          try {
            json = JSON.parse(model.data);
          } catch (err) {
            return cb(err);
          }

          return cb(null, json);
        }
        else {
          return cb(null);
        }
        
      });
  };

  WaterlineStore.prototype.set = function(sid, session, cb)  {
    var self = this;
    var json;
    var expires = session.cookie.expires || null;

    console.log('session set', sid, session);
    try {
      json = JSON.stringify(session);
    } catch(err) {
      return cb(err);
    }

    self.sessionModel
      .update({sid: sid}, {expires: expires, data: json})
      .exec(function(err, models) {
        if(err)
          return cb(err);

        if(models.length == 0) {
          self.sessionModel
            .create({sid: sid, expires: expires, data: json})
            .exec(function(err, models) {
              if(err)
                return cb(err);

              return cb(null, session);
            });
        }

        return cb(null, session);
      });
  };

  WaterlineStore.prototype.destroy = function (sid, cb) {
    var self = this;

    console.log('session destroy', sid);
    self.sessionModel
      .destroy({sid: sid}).exec(function(err) {
        if(err)
          return cb(err);

        cb(null);
      });
  };

  WaterlineStore.prototype.length = function (cb) {
    var self = this;

    self.sessionModel
      .count().exec(function(err, found) {
        if(err)
          return cb(err);

        cb(null, found);
      });
  };

  WaterlineStore.prototype.clear = function (cb) {
    var self = this;

    self.sessionModel
      .destroy().exec(function(err) {
        if(err)
          return cb(err);

        cb(null);
      });
  };

  WaterlineStore.prototype.list = function (cb) {
    var self = this;

    self.sessionModel
      .find()
      .exec(function(err, models) {
        if(err)
          return cb(err);

        cb(null, models);
      });
  };

  return WaterlineStore;
}

module.exports = init;