$s = Process.clock_gettime(Process::CLOCK_MONOTONIC)

$LOAD_PATH.unshift File.expand_path("./src/ruby", File.dirname(__FILE__))

require 'build_plan'

require 'actions/index'
require 'actions/bird_list'

require 'support/slugify'

HOST = ENV.fetch("HOST", "http://localhost:4001")

DIGEST_FILE = File.expand_path(".digests.json", File.dirname(__FILE__))

LAYOUT_FILE = "src/erb/_layout.html.erb"

SRC_FILES = Dir["src/ruby/**/*.rb"]
STATIC_FILES = Dir["src/static/**/*.{js,css,json}"]
PHOTOS = Dir["data/photos/*.jpg"]

build_plan = BuildPlan.new(digest_file: DIGEST_FILE)
BuildPlan.logger.level = Logger::INFO

site_files = []

build_plan.load do
  all_photo_metadata = PHOTOS.map do |file|
    basename = File.basename(file, ".jpg")
    target = "out/metadata/photos/#{basename}.jpg.json"
    grouped_file 'Photos', target => [File.dirname(target), file] do
      data = `exiftool -json -CreateDate -TagsList -Rating #{file}`
      raise unless $?.success?
      json = JSON.parse(data)[0]
      json["TagsList"] = [*json["TagsList"]]
      File.write(target, JSON.pretty_generate(json))
    end
    target
  end

  STATIC_FILES.each do |file|
    target = File.join("out/site", file["src/static".length..-1])

    grouped_file 'Static Files', target => [File.dirname(target), file] do
      contents = File.read(file)
      Zlib::GzipWriter.open(target) {|f| f.write(contents) }
    end
  end

  Actions::Index.new.tap do |builder|
    grouped_file 'Index', 'out/site/index.html' => [
      # 'out/metadata/index.yml',
      'src/erb/index.html.erb',
      LAYOUT_FILE,
      'out/site'
    ] do
      builder.compile_erb(LAYOUT_FILE, 'src/erb/index.html.erb', 'out/site/index.html')
    end
  end

  def parse_exif_datetime(input)
    input.sub(':', '-').sub(':', '-')
  end

  file 'out/metadata/photos_index.json' => all_photo_metadata do
    index = {}
    all_photo_metadata.each do |file|
      json = JSON.parse(File.read(file))
      tag = json.fetch('TagsList').find {|x| x.start_with?('ebird/')}
      if !tag
        puts "WARN: #{file} has no appropriate tag"
        next
      end

      name = tag.split('/', 2).last
      key = slugify(name)
      index[key] ||= {
        name: name,
        photos: []
      }

      index[key][:photos] << {
        file: json.fetch("SourceFile"),
        rating: json.fetch("Rating"),
        created_at: parse_exif_datetime(json.fetch("CreateDate"))
      }
    end

    index.each do |k, v|
      thumb = v[:photos].select {|x| x[:rating] >= 2 }.sort_by {|x| [-x[:rating], x[:created_at]] }.first
      if thumb
        thumb[:file] = '/photos/thumbnails/' + File.basename(thumb[:file])
      end
      v[:thumbnail] = thumb
    end

    File.write('out/metadata/photos_index.json', JSON.pretty_generate(index))
  end

  target = 'out/site/birds.json'
  file target => ['data/csv/MyEBirdData.csv', 'out/metadata/photos_index.json'] do
    Zlib::GzipWriter.open(target) {|f|
      contents = JSON.pretty_generate(Actions::BirdList.new("data/csv/MyEBirdData.csv", 'out/metadata/photos_index.json').life_list)
      f.write(contents)
    }
  end
end

# TODO: Remove metadata here once done dev'ing
SITE_FILES = build_plan.tasks.keys.select {|x| x.start_with?("out/site") || x.start_with?("out/metadata") }

DIRS = build_plan.tasks.values
  .select {|x| x.is_a?(BuildPlan::Target::IntermediaryFile) }
  .map {|x| File.dirname(x.target) }
  .uniq

build_plan.load do
  DIRS.each do |d|
    directory d
  end

  task "build" => SITE_FILES do
    # Just do this everytime, it's quick and not worth replicating rsync
    # functionality inside this file.
    `rsync -a data/images out/site/`

    # TODO: actually make the thumbnails
    `mkdir -p out/site/photos/thumbnails`
    `rsync -a data/photos/ out/site/photos/thumbnails/`
  end
end

build_plan.build "build"


build_plan.save_digests!(DIGEST_FILE)
