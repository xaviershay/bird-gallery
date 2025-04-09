require 'support/builder'

class Actions::Index < Builder
  def compile_erb(layout, template, output)
    metadata = {} # YAML.load_file(metadata_file, permitted_classes: [Date])

    @site = hash_to_ostruct(metadata)
    #@site.extend(RunSiteMethods)

    @content = load_template(template).result(binding)
    @metadata_title = "Bird Gallery - Xavier Shay"
    @title = "Bird Gallery"
    @subtitle = ""
    @class = "index"

    html = load_template(layout).result(binding)
    write_gzip output, html
  rescue Psych::BadAlias
    puts File.read(metadata_file)

    raise "Failed to YAML parse #{metadata_file}"
  end
end
