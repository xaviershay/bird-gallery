require 'csv'
require 'date'
require 'support/slugify'

class Actions::BirdList
  def initialize(ebird_data_csv, photos_index_json)
    @path = ebird_data_csv
    @photos_index = JSON.parse(File.read(photos_index_json))
  end

  def life_list
    birds = {}

    CSV.foreach(@path, headers: true) do |row|
      bird_name = row['Common Name']
      sighting = {
        location_id: row['Location ID'],
        state_province: row['State/Province'],
        date: Date.parse(row['Date'])
      }

      birds[bird_name] ||= begin
        slug = slugify(bird_name)
        photos = @photos_index.fetch(slug, {})
        thumbnail = photos.fetch('thumbnail', nil)

        {
          name: bird_name,
          slug: slug,
          sightings: [],
          newest: nil,
          oldest: nil,
          photos: photos.fetch('photos', []),
          thumbnail: (thumbnail || {}).fetch('file', nil)
        }
      end
      birds[bird_name][:sightings] << sighting
      birds[bird_name][:oldest] = [birds[bird_name][:first_sighted], sighting[:date]].compact.min
      birds[bird_name][:newest] = [birds[bird_name][:most_recent_sighted], sighting[:date]].compact.max
    end

    birds.values.sort_by { |bird| -bird[:oldest].to_time.to_i }
  end
end