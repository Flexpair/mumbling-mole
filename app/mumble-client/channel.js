import { EventEmitter } from 'node:events'

class Channel extends EventEmitter {
  constructor (client, id) {
    super()
    this._client = client
    this._id = id
    this._links = []
    this.users = []
    this.children = []
    this._haveRequestedDescription = false
  }

  _remove () {
    if (this.parent) {
      const index = this.parent.children.indexOf(this)
      if (index !== -1) {
        this.parent.children.splice(index, 1)
      }
    }
    this.emit('remove')
  }

  _updateLinks (msg, changes) {
    if (msg.links) {
      this._links = msg.links
      changes.links = this.links
    }
    if (msg.links_remove) {
      this._links = this._links.filter(e => !msg.links_remove.includes(e))
      changes.links = this.links
    }
    if (msg.links_add) {
      const newLinks = msg.links_add.filter(e => !this._links.includes(e))
      for (const link of newLinks) {
        this._links.push(link)
      }
      changes.links = this.links
    }
  }

  _update (msg) {
    const changes = {}
    if (msg.name != null) {
      changes.name = this._name = msg.name
    }
    if (msg.description != null) {
      changes.description = this._description = msg.description
    }
    if (msg.description_hash != null) {
      changes.descriptionHash = this._descriptionHash = msg.description_hash
      this._haveRequestedDescription = false // invalidate previous request
    }
    if (msg.temporary != null) {
      changes.temporary = this._temporary = msg.temporary
    }
    if (msg.position != null) {
      changes.position = this._position = msg.position
    }
    if (msg.max_users != null) {
      changes.maxUsers = this._maxUsers = msg.max_users
    }
    this._updateLinks(msg, changes)
    if (msg.parent != null) {
      if (this.parent) {
        const index = this.parent.children.indexOf(this)
        if (index !== -1) {
          this.parent.children.splice(index, 1)
        }
      }
      this._parentId = msg.parent
      if (this.parent) {
        this.parent.children.push(this)
      }
      changes.parent = this.parent
    }
    this.emit('update', changes)
  }

  sendMessage (message) {
    this._client._send({
      name: 'TextMessage',
      payload: {
        channelId: [this._id],
        message: message
      }
    })
  }

  sendTreeMessage (message) {
    this._client._send({
      name: 'TextMessage',
      payload: {
        treeId: [this._id],
        message: message
      }
    })
  }

  requestDescription () {
    if (this._haveRequestedDescription) return
    this._client._send({
      name: 'RequestBlob',
      payload: {
        channel_description: this._id
      }
    })
    this._haveRequestedDescription = true
  }

  get id () {
    return this._id
  }

  get name () {
    return this._name
  }

  set name (to) {
    throw new Error('Cannot set name. Use #setName(name) instead.')
  }

  get parent () {
    return this._client._channelById[this._parentId]
  }

  set parent (to) {
    throw new Error('Cannot set parent. Use #setParent(channel) instead.')
  }

  get description () {
    return this._description
  }

  set description (to) {
    throw new Error(
      'Cannot set description. Use #setDescription(desc) instead.'
    )
  }

  get descriptionHash () {
    return this._descriptionHash
  }

  set descriptionHash (to) {
    throw new Error('Cannot set descriptionHash.')
  }

  get temporary () {
    return this._temporary
  }

  set temporary (to) {
    throw new Error('Cannot set temporary. Use #setTemporary(tmp) instead.')
  }

  get position () {
    return this._position
  }

  set position (to) {
    throw new Error('Cannot set position.')
  }

  get maxUsers () {
    return this._maxUsers
  }

  set maxUsers (to) {
    throw new Error('Cannot set maxUsers.')
  }

  get links () {
    return this._links.map(id => this._client._channelById[id])
  }

  set links (to) {
    throw new Error('Cannot set links. Use #setLinks(links) instead.')
  }
}

export default Channel
