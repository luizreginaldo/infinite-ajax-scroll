import $ from 'tealight';
import extend from 'extend';
import throttle from 'lodash.throttle';
import Emitter from 'tiny-emitter';

var defaults = {
  item: '',
  pagination: {},
  next: '',
  responseType: 'document',
  bind: true,
  scrollContainer: window,
  spinner: false
};

var Assert = {
  singleElement: function singleElement(elementOrSelector, property) {
    var $element = $(elementOrSelector);

    if ($element.length > 1) {
      throw new Error(("Expected single element for \"" + property + "\""));
    }
    
    if ($element.length === 0) {
      throw new Error(("Element \"" + elementOrSelector + "\" not found for \"" + property + "\""));
    }
  }
};

function getScrollPosition(el) {
  if (el !== window) {
    return {
      x: el.scrollLeft,
      y: el.scrollTop,
    };
  }

  var supportPageOffset = window.pageXOffset !== undefined;
  var isCSS1Compat = ((document.compatMode || "") === "CSS1Compat");

  return {
    x: supportPageOffset ? window.pageXOffset : isCSS1Compat ? document.documentElement.scrollLeft : document.body.scrollLeft,
    y: supportPageOffset ? window.pageYOffset : isCSS1Compat ? document.documentElement.scrollTop : document.body.scrollTop
  };
}

function getRootRect(el) {
  var rootRect;

  if (el !== window) {
    rootRect = el.getBoundingClientRect();
  } else {
    // Use <html>/<body> instead of window since scroll bars affect size.
    var html = document.documentElement;
    var body = document.body;

    rootRect = {
      top: 0,
      left: 0,
      right: html.clientWidth || body.clientWidth,
      width: html.clientWidth || body.clientWidth,
      bottom: html.clientHeight || body.clientHeight,
      height: html.clientHeight || body.clientHeight
    };
  }

  return rootRect;
}

function getDistanceToFold(el, scrollContainer) {
  var scroll = getScrollPosition(scrollContainer);
  var rootRect = getRootRect(scrollContainer);
  var boundingRect = el.getBoundingClientRect();

  var scrollYBottom = scroll.y + rootRect.height;
  var bottom = scroll.y + boundingRect.bottom - rootRect.top;

  return bottom - scrollYBottom;
}

function scrollHandler() {
  var distance = getDistanceToFold(this.sentinel(), this.scrollContainer);

  this.emitter.emit('scrolled');

  if (distance <= 0) {
    this.emitter.emit('hit', {
      distance: distance
    });
  }
}

function resizeHandler() {
  var distance = getDistanceToFold(this.sentinel(), this.scrollContainer);

  this.emitter.emit('resized');

  if (distance <= 0) {
    this.emitter.emit('hit', {
      distance: distance
    });
  }
}

var scrollListener;
var resizeListener;

var InfiniteAjaxScroll = function InfiniteAjaxScroll(container, options) {
  if ( options === void 0 ) options = {};

  Assert.singleElement(container, 'container');

  this.container = $(container)[0];
  this.options = extend({}, defaults, options);
  this.emitter = new Emitter();
  this.scrollContainer = this.options.scrollContainer;

  if (this.options.scrollContainer !== window) {
    Assert.singleElement(this.options.scrollContainer, 'options.scrollContainer');

    this.scrollContainer = $(this.options.scrollContainer)[0];
  }

  this.binded = false;

  if (this.options.bind) {
    // @todo on document.ready?
    this.bind();
  }
};

InfiniteAjaxScroll.prototype.bind = function bind () {
  scrollListener = throttle(scrollHandler, 200).bind(this);
  resizeListener = throttle(resizeHandler, 200).bind(this);

  this.scrollContainer.addEventListener('scroll', scrollListener);
  this.scrollContainer.addEventListener('resize', resizeListener);

  this.binded = true;

  this.emitter.emit('binded');
};

InfiniteAjaxScroll.prototype.unbind = function unbind () {
  this.scrollContainer.removeEventListener('resize', resizeListener);
  this.scrollContainer.removeEventListener('scroll', scrollListener);

  this.binded = false;

  this.emitter.emit('unbinded');
};

InfiniteAjaxScroll.prototype.load = function load (url) {
  var ias = this;

  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function() {
      if (xhr.readyState !== XMLHttpRequest.DONE) {
        return;
      }

      if (xhr.status === 200) {
        var items = xhr.response;

        if (ias.options.responseType === 'document') {
          items = $(ias.options.item, xhr.response);
        }

        // @todo define event variable and pass that around so it can be manipulated

        ias.emitter.emit('loaded', items, url, xhr);

        resolve({items: items, url: url, xhr: xhr});
      } else {
        // @todo this console.error the best approach?
        console.error('Request failed');

        reject(xhr);
      }
    };

    // FIXME: make no-caching configurable
    // @see https://developer.mozilla.org/nl/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest#Bypassing_the_cache
    url = url + ((/\?/).test(url) ? "&" : "?") + (new Date()).getTime();

    xhr.open('GET', url, true);
    xhr.responseType = ias.options.responseType;
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    ias.emitter.emit('load', url, xhr);

    xhr.send();
  });
};

InfiniteAjaxScroll.prototype.sentinel = function sentinel () {
  var items = $(this.options.item, this.container);

  if (!items.length) {
    throw new Error(("Item \"" + (this.options.item) + "\" not found"));
  }

  return items[items.length-1];
};

InfiniteAjaxScroll.prototype.on = function on (event, callback) {
  this.emitter.on(event, callback, this);

  if (event === 'binded' && this.binded) {
    callback.bind(this)();
  }
};

InfiniteAjaxScroll.prototype.off = function off (event, callback) {
  this.emitter.off(event, callback, this);
};

InfiniteAjaxScroll.prototype.once = function once (event, callback) {
  this.emitter.once(event, callback, this);

  if (event === 'binded' && this.binded) {
    callback.bind(this)();
  }
};

export default InfiniteAjaxScroll;